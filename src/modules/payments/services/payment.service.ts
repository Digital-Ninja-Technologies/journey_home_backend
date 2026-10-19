import mongoose, { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { env } from "../../../config/application";
import { IBillingSchedule } from "../../billing/models/billing-schedule.model";
import { BillingScheduleService } from "../../billing/services/billing-schedule.service";
import { addOneMonthPreservingBillingDay } from "../../plans/services/date.service";
import { PlanStatus } from "../../plans/models/plan.model";
import { NotificationEvent } from "../../notifications/models/notification.model";
import { NotificationService } from "../../notifications/services/notification.service";
import {
  PaymentPurpose,
  PaymentProvider,
  PaymentStatus,
  IPayment,
} from "../models/payment.model";
import { PaystackService, PaystackTransactionData } from "./paystack.service";
import { PaymentRepository } from "../repositories/payment.repository";


export class PaymentService {
  private repository = new PaymentRepository();

  // Generates a unique payment reference with a purpose-specific prefix.
  private reference(prefix: string): string {
    return `${prefix}_${uuidv4().replace(/-/g, "")}`;
  }

  async initializeInitialCheckout(
    planId: string,
    ownerId: string,
  ): Promise<{
    payment: IPayment;
    authorizationUrl: string;
    accessCode: string;
    reference: string;
  }> {
    const plan = await this.repository.findPlanForOwner(planId, ownerId);
    if (!plan) throw new NotFoundError("Plan not found");

    // Only pending plans can start their initial payment checkout.
    if (plan.status !== PlanStatus.PENDING) {
      throw new BadRequestError(
        "Initial checkout is only available for pending plans",
      );
    }

    const user = await this.repository.findUserEmail(ownerId);
    if (!user?.email)
      throw new BadRequestError(
        "User email is required for payment initialization",
      );

    // Reuse an existing initial payment when available to avoid creating unnecessary records.
    let payment = await this.repository.findReusableInitial(plan._id, ownerId);
    const newOwnerId = new Types.ObjectId(ownerId);

    if (!payment) {
      payment = await this.repository.createPayment({
        owner: newOwnerId,
        plan: plan._id,
        amountMinor: plan.contributionAmountMinor,
        currency: plan.currency,
        reference: this.reference("jh_init"),
        providerReference: undefined,
        provider: PaymentProvider.PAYSTACK,
        purpose: PaymentPurpose.INITIAL,
        status: PaymentStatus.PENDING,
      });
    }

    // Initialize checkout with Paystack and associate the transaction with the plan and payment.
    const initialized = await new PaystackService().initializeTransaction({
      email: user.email,
      amount: payment.amountMinor,
      currency: payment.currency,
      reference: payment.reference,
      metadata: {
        planId: plan._id.toString(),
        paymentId: payment._id.toString(),
        purpose: payment.purpose,
      },
    });

    await this.repository.updatePayment(payment._id, {
      $set: {
        providerReference: initialized.reference,
        status: PaymentStatus.PROCESSING,
      },
    });
    payment.providerReference = initialized.reference;
    payment.status = PaymentStatus.PROCESSING;

    return {
      payment,
      authorizationUrl: initialized.authorization_url,
      accessCode: initialized.access_code,
      reference: initialized.reference,
    };
  }

  // Fetches the transaction status from Paystack before applying its result locally.
  async verifyAndApply(reference: string): Promise<IPayment> {
    const providerData = await new PaystackService().verifyTransaction(
      reference,
    );
    console.log(providerData);
    
    return this.applyProviderTransaction(providerData);
  }

  async applyProviderTransaction(
    providerData: PaystackTransactionData,
  ): Promise<IPayment> {
    if (!providerData.reference)
      throw new BadRequestError("Provider reference is missing");

    const payment = await this.repository.findByProviderReference(
      providerData.reference,
    );
    if (!payment) throw new NotFoundError("Payment not found");

    // Avoid applying the same successful payment more than once.
    if (payment.status === PaymentStatus.SUCCESSFUL) return payment;

    // Reject provider responses whose amount or currency differs from the recorded payment.
    if (
      providerData.amount !== payment.amountMinor ||
      providerData.currency !== payment.currency
    ) {
      throw new BadRequestError("Payment verification mismatch");
    }

    const successful = providerData.status === "success";
    const session = await mongoose.startSession();

    try {
      // Update the payment and related plan records atomically.
      await session.withTransaction(async () => {
        const current = await this.repository.findCurrentPayment(
          payment._id,
          session,
        );

        if (!current || current.status === PaymentStatus.SUCCESSFUL) return;

        current.status = successful
          ? PaymentStatus.SUCCESSFUL
          : PaymentStatus.FAILED;
        
        current.providerTransactionId = providerData.id?.toString();

        current.failureMessage = successful
          ? undefined
          : providerData.gateway_response;
        
        current.processedAt = new Date();

        current.metadata = { providerStatus: providerData.status };

        await this.repository.savePayment(current, session);

        if (successful) {
          const plan = await this.repository.findPlanById(
            current.plan,
            session,
          );
          if (!plan) throw new NotFoundError("Plan not found");

          // Update the plan's payment details and next payment date.
          await this.repository.updatePlanAfterPayment(
            plan._id,
            current.amountMinor,
            addOneMonthPreservingBillingDay(new Date()),
            session,
          );

          // Store reusable authorization details for future recurring charges.
          if (
            providerData.authorization?.authorization_code &&
            providerData.authorization.reusable
          ) {
            await this.repository.upsertAuthorization(
              {
                plan: current.plan,
                authorizationCode:
                  providerData.authorization.authorization_code,
              },
              {
                owner: current.owner,
                plan: current.plan,
                provider: "paystack",

                authorizationCode:
                  providerData.authorization.authorization_code,
                
                customerCode: providerData.customer?.customer_code,
                customerEmail: providerData.customer?.email || "",
                reusable: Boolean(providerData.authorization.reusable),
                channel: providerData.authorization.channel,
                cardType: providerData.authorization.card_type,
                bank: providerData.authorization.bank,
                last4: providerData.authorization.last4,
                expMonth: providerData.authorization.exp_month,
                expYear: providerData.authorization.exp_year,
                active: true,
              },
              session,
            );
          }
        }
      });
    } finally {
      // Release the session whether the transaction succeeds or fails.
      await session.endSession();
    }

    const updated = await this.repository.findById(payment._id);
    if (!updated) throw new NotFoundError("Payment not found");

    // Select the notification event based on payment purpose and outcome.
    const event =
      updated.purpose === PaymentPurpose.INITIAL
        ? successful
          ? NotificationEvent.INITIAL_PAYMENT_SUCCESS
          : NotificationEvent.INITIAL_PAYMENT_FAILURE
        : successful
          ? NotificationEvent.RECURRING_PAYMENT_SUCCESS
          : NotificationEvent.RECURRING_PAYMENT_FAILURE;

    await new NotificationService().record(
      updated.owner.toString(),
      updated.plan.toString(),
      event,
      `${updated._id}:${event}`,
    );

    // Activate the initial billing schedule after the first payment succeeds.
    if (successful && updated.purpose === PaymentPurpose.INITIAL) {
      await new BillingScheduleService().activateForPlan(
        updated.plan,
        addOneMonthPreservingBillingDay(new Date()),
      );
    }

    return updated;
  }

  // Validates and processes a Paystack webhook, recording its outcome for retry and deduplication.
  async processWebhook(
    payload: any,
    rawBody: Buffer | undefined,
    signature: string | string[] | undefined,
  ): Promise<{ status: string }> {
    const paystack = new PaystackService();

    // Verify that the webhook was signed by Paystack before trusting its contents.
    if (!paystack.verifySignature(rawBody, signature)) {
      throw new BadRequestError("Invalid Paystack signature");
    }

    const reference = payload?.data?.reference;

    // Build an event key to prevent the same webhook event from being processed repeatedly.
    const eventKey = `${payload?.event || "unknown"}:${reference || payload?.data?.id || uuidv4()}`;
    const event = await this.repository.createPaystackEvent(
      eventKey,
      payload?.event || "unknown",
      reference,
    );

    if (!event || event.status === "Processed" || event.status === "Ignored")
      return { status: "duplicate" };

    try {
      if (payload.event === "charge.success" && reference) {
        await this.verifyAndApply(reference);
        event.status = "Processed";
      } else if (payload.event === "charge.failed" && reference) {
        await this.repository.markProviderFailure(
          reference,
          payload?.data?.gateway_response,
        );
        event.status = "Processed";
      } else {
        event.status = "Ignored";
      }

      await this.repository.savePaystackEvent(event);
      return { status: event.status };
    } catch (error: any) {
      // Record the error so failed webhook processing can be investigated or retried.
      event.status = "Failed";
      event.errorMessage = error.message;
      await this.repository.savePaystackEvent(event);
      throw error;
    }
  }

  async listForOwner(ownerId: string): Promise<IPayment[]> {
    return this.repository.listForOwner(ownerId);
  }

  async getForOwner(paymentId: string, ownerId: string): Promise<IPayment> {
    const payment = await this.repository.findForOwner(paymentId, ownerId);
    if (!payment) throw new NotFoundError("Payment not found");
    return payment;
  }

  // Charges the saved reusable authorization for a scheduled recurring payment.
  async chargeRecurring(schedule: IBillingSchedule): Promise<void> {
    const plan = await this.repository.findPlanById(schedule.plan);

    // Skip plans that no longer accept payments.
    if (
      !plan ||
      plan.status === PlanStatus.CANCELLED ||
      plan.status === PlanStatus.COMPLETED
    )
      return;

    const authorization = await this.repository.findReusableAuthorization(
      plan._id,
    );
    if (!authorization)
      throw new BadRequestError(
        "Reusable payment authorization is not available for this plan",
      );

    const payment = await this.repository.createPayment({
      owner: plan.owner,
      plan: plan._id,
      amountMinor: plan.contributionAmountMinor,
      currency: plan.currency,
      reference: this.reference("jh_rec"),
      provider: PaymentProvider.PAYSTACK,
      purpose: PaymentPurpose.RECURRING,
      status: PaymentStatus.PROCESSING,
      billingCycle: schedule.billingCycle,
      authorization: authorization._id,
    });

    try {
      // Charge the saved authorization through Paystack and link the result to this payment.
      const result = await new PaystackService().chargeAuthorization({
        email: authorization.customerEmail,
        amount: payment.amountMinor,
        currency: payment.currency,
        authorization_code: authorization.authorizationCode,
        reference: payment.reference,
        metadata: {
          planId: plan._id.toString(),
          paymentId: payment._id.toString(),
          billingCycle: schedule.billingCycle,
        },
      });

      await this.applyProviderTransaction({
        ...result,
        reference: result.reference || payment.reference,
      });

      // Keep the billing schedule in sync with the provider's payment outcome.
      if (result.status === "success") {
        await new BillingScheduleService().recordSuccess(schedule, payment._id);
      } else {
        await new BillingScheduleService().recordFailure(schedule, payment._id);
      }
    } catch (error: any) {
      await this.repository.updatePayment(payment._id, {
        $set: {
          status: PaymentStatus.FAILED,
          failureMessage: error.message,
          processedAt: new Date(),
        },
      });
      await new BillingScheduleService().recordFailure(schedule, payment._id);
    }
  }
}
