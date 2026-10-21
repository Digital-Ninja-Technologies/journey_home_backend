import mongoose, { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { ConflictError } from "../../../common/errors/ConflictError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
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
import { SubscriptionRepository } from "../../subscriptions/repositories/subscription.repository";
import { SubscriptionStatus } from "../../subscriptions/models/subscription.model";

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

    const pkg = await this.repository.findPlanPackage(plan.package);
    if (!pkg?.paystackPlanCode)
      throw new BadRequestError("Package is not configured for subscriptions");
    const subscriptions = new SubscriptionRepository();
    const otherPending = await subscriptions.findOtherPendingForOwnerPlanCode(
      ownerId,
      pkg.paystackPlanCode,
      plan._id,
    );

    if (otherPending)
      throw new ConflictError(
        "Complete the existing checkout for this package before starting another plan checkout",
      );
    
    let subscription = await subscriptions.findByPlan(plan._id);

    if (!subscription)
      subscription = await subscriptions.create({
        owner: plan.owner,
        plan: plan._id,
        package: plan.package,
        provider: "paystack",
        providerPlanCode: pkg.paystackPlanCode,
        status: SubscriptionStatus.PENDING,
      });

    else if (subscription.status !== SubscriptionStatus.PENDING)
      throw new BadRequestError("A subscription already exists for this plan");
      
    else if (subscription.providerPlanCode !== pkg.paystackPlanCode) {
      subscription.providerPlanCode = pkg.paystackPlanCode;
      await subscription.save();
    }

    // Reuse an existing initial payment when available to avoid creating unnecessary records.
    let payment = await this.repository.findReusableInitial(plan._id, ownerId);
    const newOwnerId = new Types.ObjectId(ownerId);

    if (!payment) {
      payment = await this.repository.createPayment({
        owner: newOwnerId,
        plan: plan._id,
        amount: plan.amount,
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
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      plan: pkg.paystackPlanCode,
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
      providerData.amount !== payment.amount ||
      providerData.currency !== payment.currency
    ) {
      throw new BadRequestError("Payment verification mismatch");
    }

    const successful = providerData.status === "success";
    const subscriptions = new SubscriptionRepository();
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

          // Payment success activates the business plan. Paystack's subscription event supplies its schedule.
          await this.repository.updatePlanAfterPayment(
            plan._id,
            current.amount,
            undefined,
            session,
          );

          const sub = await subscriptions.findByPlan(current.plan);

          if (sub && sub.status === SubscriptionStatus.ACTIVE) {
            sub.lastPaymentAt = new Date();
            await sub.save({ session });
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
      if (payload.event === "subscription.create") {

        const data = payload.data || {};

        const customer = typeof data.customer === "object" ? data.customer : {};

        const providerPlan = typeof data.plan === "object" ? data.plan : {};

        const owner = customer.customer_code
          ? await this.repository.findOwnerByEmail(customer.email)
          : null;
        
        const candidates =
          owner && providerPlan.plan_code
            ? await new SubscriptionRepository().findPendingForOwnerPlanCode(
                owner._id,
                providerPlan.plan_code,
              )
            : [];
        
        if (candidates.length > 1)
          throw new BadRequestError(
            "Paystack subscription cannot be matched to a unique pending Journey Home plan",
          );
        
        const pending = candidates[0];

        if (pending && data.subscription_code) {

          const next = data.next_payment_date
            ? new Date(data.next_payment_date)
            : undefined;
          
          await new SubscriptionRepository().attachProvider({
            id: pending._id,
            code: data.subscription_code,
            customerCode: customer.customer_code,
            nextPaymentDate: next,
            startedAt: data.createdAt ? new Date(data.createdAt) : new Date(),
          });

          if (next)
            await this.repository.updatePlanNextPaymentDate(pending.plan, next);

        } else event.status = "Ignored";

      } else if (payload.event === "charge.success" && reference) {

        await this.applyChargeSuccess(payload.data);
        event.status = "Processed";
      } else if (
        [
          "invoice.update",
          "invoice.create",
          "invoice.payment_failed",
          "subscription.not_renew",
          "subscription.disable",
        ].includes(payload.event)
      ) {
        const data = payload.data || {};

        const code =
          data.subscription?.subscription_code || data.subscription_code;
        
        const local = code
          ? await new SubscriptionRepository().findByProviderCode(code)
          : null;
        if (local) {
          const nextDate =
            data.subscription?.next_payment_date || data.next_payment_date;
          
          if (nextDate) {
            local.nextPaymentDate = new Date(nextDate);
            await this.repository.updatePlanNextPaymentDate(
              local.plan,
              local.nextPaymentDate,
            );
          }

          if (payload.event === "invoice.payment_failed")

            local.status = SubscriptionStatus.ATTENTION;
          
          if (payload.event === "subscription.not_renew")

            local.status = SubscriptionStatus.NON_RENEWING;
          
          if (payload.event === "subscription.disable") {
            local.status =
              data.status === "complete"
                ? SubscriptionStatus.COMPLETED
                : SubscriptionStatus.CANCELLED;
            if (local.status === SubscriptionStatus.CANCELLED)
              local.cancelledAt = new Date();
          }

          await local.save();

          if (
            payload.event === "invoice.payment_failed" &&
            data.invoice_code &&
            !(await this.repository.findByProviderReference(data.invoice_code))
          ) {

            const plan = await this.repository.findPlanById(local.plan);

            if (plan)
              await this.repository.createPayment({
                owner: local.owner,
                plan: local.plan,
                amount: Number(
                  data.amount || plan.amount,
                ),
                currency: plan.currency,
                reference: `paystack_${data.invoice_code}`,
                providerReference: data.invoice_code,
                provider: PaymentProvider.PAYSTACK,
                purpose: PaymentPurpose.RECURRING,
                status: PaymentStatus.FAILED,
                failureMessage:
                  data.description ||
                  "Paystack subscription invoice payment failed",
                processedAt: new Date(),
                metadata: { invoiceCode: data.invoice_code },
              });
          }
        }
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

  private async applyChargeSuccess(data: any): Promise<void> {
    const reference = String(data.reference || "");
    if (!reference) throw new BadRequestError("Provider reference is missing");
    const exists = await this.repository.findByProviderReference(reference);
    if (exists) {
      await this.verifyAndApply(reference);
      return;
    }
    const code = data.subscription?.subscription_code || data.subscription_code;
    const subscription = code
      ? await new SubscriptionRepository().findByProviderCode(code)
      : null;
    if (!subscription) {
      // The first charge webhook can arrive before subscription.create; verify and defer reconciliation.
      throw new BadRequestError(
        "Paystack subscription is not yet linked to a local plan; webhook will be retried",
      );
    }
    const providerData = await new PaystackService().verifyTransaction(
      reference,
    );
    await this.createAndApplyRecurring(providerData, subscription);
  }

  private async createAndApplyRecurring(
    data: PaystackTransactionData,
    subscription: any,
  ) {
    if (!data.reference || data.amount === undefined || !data.currency)
      throw new BadRequestError("Incomplete Paystack transaction data");
    const plan = await this.repository.findPlanById(subscription.plan);
    if (!plan) throw new NotFoundError("Plan not found");
    await this.repository.createPayment({
      owner: subscription.owner,
      plan: subscription.plan,
      amount: data.amount,
      currency: data.currency,
      reference: data.reference,
      providerReference: data.reference,
      providerTransactionId: data.id?.toString(),
      provider: PaymentProvider.PAYSTACK,
      purpose: PaymentPurpose.RECURRING,
      status: PaymentStatus.PROCESSING,
    });
    await this.applyProviderTransaction(data);
  }

  async listForOwner(ownerId: string): Promise<IPayment[]> {
    return this.repository.listForOwner(ownerId);
  }

  async getForOwner(paymentId: string, ownerId: string): Promise<IPayment> {
    const payment = await this.repository.findForOwner(paymentId, ownerId);
    if (!payment) throw new NotFoundError("Payment not found");
    return payment;
  }

}
