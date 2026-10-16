// Imports mongoose from mongoose.
import mongoose, { Types } from "mongoose";
// Imports v4 as uuidv4 from uuid.
import { v4 as uuidv4 } from "uuid";
// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";
// Imports NotFoundError from ../../../common/errors/NotFoundError.
import { NotFoundError } from "../../../common/errors/NotFoundError";
// Imports env from ../../../config/application.
import { env } from "../../../config/application";
// Imports IBillingSchedule from ../../billing/models/billing-schedule.model.
import { IBillingSchedule } from "../../billing/models/billing-schedule.model";
// Imports BillingScheduleService from ../../billing/services/billing-schedule.service.
import { BillingScheduleService } from "../../billing/services/billing-schedule.service";
// Imports addOneMonthPreservingBillingDay from ../../plans/services/date.service.
import { addOneMonthPreservingBillingDay } from "../../plans/services/date.service";
// Imports PlanStatus from ../../plans/models/plan.model.
import { PlanStatus } from "../../plans/models/plan.model";
// Imports NotificationEvent from ../../notifications/models/notification.model.
import { NotificationEvent } from "../../notifications/models/notification.model";
// Imports NotificationService from ../../notifications/services/notification.service.
import { NotificationService } from "../../notifications/services/notification.service";
// Imports PaymentPurpose, PaymentProvider, PaymentStatus, IPayment from ../models/payment.model.
import { PaymentPurpose, PaymentProvider, PaymentStatus, IPayment } from "../models/payment.model";
// Imports PaystackService, PaystackTransactionData from ./paystack.service.
import { PaystackService, PaystackTransactionData } from "./paystack.service";
// Imports PaymentRepository from ../repositories/payment.repository.
import { PaymentRepository } from "../repositories/payment.repository";

// Declares the service class that groups related application operations.
export class PaymentService {
  // Provides the next part of the surrounding operation.
  private repository = new PaymentRepository();
  // Performs the requested service operation.
  // Provides the next part of the surrounding operation.
  private reference(prefix: string): string {
    // Returns `${prefix}_${uuidv4().replace(/-/g, "")}` to the caller.
    return `${prefix}_${uuidv4().replace(/-/g, "")}`;
  // Closes the current block.
  }

  // Creates or reuses an initial payment and starts provider checkout.
  // Declares a function or method used by this service.
  async initializeInitialCheckout(planId: string, ownerId: string): Promise<{ payment: IPayment; authorizationUrl: string; accessCode: string; reference: string }> {
    // Stores the result of this.repository.findPlanForOwner in plan.
    const plan = await this.repository.findPlanForOwner(planId, ownerId);
    // Runs the following branch when !plan) throw new NotFoundError("Plan not found" is true.
    if (!plan) throw new NotFoundError("Plan not found");
    // Runs the following branch when plan.status !== PlanStatus.PENDING is true.
    if (plan.status !== PlanStatus.PENDING) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Initial checkout is only available for pending plans");
    // Closes the current block.
    }
    // Stores the result of this.repository.findUserEmail in user.
    const user = await this.repository.findUserEmail(ownerId);
    // Runs the following branch when !user?.email) throw new BadRequestError("User email is required for payment initializ is true.
    if (!user?.email) throw new BadRequestError("User email is required for payment initialization");

    // Stores the result of this.repository.findReusableInitial in payment.
    let payment = await this.repository.findReusableInitial(plan._id, ownerId);
    const newOwnerId = new Types.ObjectId(ownerId);

    // Runs the following branch when !payment is true.
    if (!payment) {
      // Updates payment with the value on the right-hand side.
      payment = await this.repository.createPayment({
        // Declares the owner property with type or value ownerId,.
        owner: newOwnerId,
        // Declares the plan property with type or value plan._id,.
        plan: plan._id,
        // Declares the amountMinor property with type or value plan.contributionAmountMinor,.
        amountMinor: plan.contributionAmountMinor,
        // Declares the currency property with type or value plan.currency,.
        currency: plan.currency,
        // Declares the reference property with type or value this.reference("jh_init"),.
        reference: this.reference("jh_init"),
        // Declares the providerReference property with type or value undefined,.
        providerReference: undefined,
        // Declares the provider property with type or value PaymentProvider.PAYSTACK,.
        provider: PaymentProvider.PAYSTACK,
        // Declares the purpose property with type or value PaymentPurpose.INITIAL,.
        purpose: PaymentPurpose.INITIAL,
        // Declares the status property with type or value PaymentStatus.PENDING,.
        status: PaymentStatus.PENDING,
      // Closes the current block.
      });
    // Closes the current block.
    }

    // Stores the result of PaystackService in initialized.
    const initialized = await new PaystackService().initializeTransaction({
      // Declares the email property with type or value user.email,.
      email: user.email,
      // Declares the amount property with type or value payment.amountMinor,.
      amount: payment.amountMinor,
      // Declares the currency property with type or value payment.currency,.
      currency: payment.currency,
      // Declares the reference property with type or value payment.reference,.
      reference: payment.reference,
      // Declares the callback_url property with type or value env.PAYSTACK_CALLBACK_URL || undefined,.
      callback_url: env.PAYSTACK_CALLBACK_URL || undefined,
      // Declares the metadata property with type or value { planId: plan._id.toString(), paymentId: payment._id.toString(), purp.
      metadata: { planId: plan._id.toString(), paymentId: payment._id.toString(), purpose: payment.purpose },
    // Closes the current block.
    });

    // Waits for repository.updatePayment to finish before continuing.
    await this.repository.updatePayment(payment._id, { $set: { providerReference: initialized.reference, status: PaymentStatus.PROCESSING } });
    // Updates payment.providerReference with the value on the right-hand side.
    payment.providerReference = initialized.reference;
    // Updates payment.status with the value on the right-hand side.
    payment.status = PaymentStatus.PROCESSING;

    // Returns { to the caller.
    return {
      // Provides the next part of the surrounding operation.
      payment,
      // Declares the authorizationUrl property with type or value initialized.authorization_url,.
      authorizationUrl: initialized.authorization_url,
      // Declares the accessCode property with type or value initialized.access_code,.
      accessCode: initialized.access_code,
      // Declares the reference property with type or value initialized.reference,.
      reference: initialized.reference,
    // Closes the current block.
    };
  // Closes the current block.
  }

  // Verifies a provider transaction and applies it to the account.
  // Declares a function or method used by this service.
  async verifyAndApply(reference: string): Promise<IPayment> {
    // Stores the result of PaystackService in providerData.
    const providerData = await new PaystackService().verifyTransaction(reference);
    // Returns this.applyProviderTransaction(providerData) to the caller.
    return this.applyProviderTransaction(providerData);
  // Closes the current block.
  }

  // Updates payment and plan records from a provider transaction.
  // Declares a function or method used by this service.
  async applyProviderTransaction(providerData: PaystackTransactionData): Promise<IPayment> {
    // Runs the following branch when !providerData.reference) throw new BadRequestError("Provider reference is missing" is true.
    if (!providerData.reference) throw new BadRequestError("Provider reference is missing");
    // Stores the result of this.repository.findByProviderReference in payment.
    const payment = await this.repository.findByProviderReference(providerData.reference);
    // Runs the following branch when !payment) throw new NotFoundError("Payment not found" is true.
    if (!payment) throw new NotFoundError("Payment not found");
    // Runs the following branch when payment.status === PaymentStatus.SUCCESSFUL is true.
    if (payment.status === PaymentStatus.SUCCESSFUL) return payment;

    // Runs the following branch when providerData.amount !== payment.amountMinor || providerData.currency !== payment.curr is true.
    if (providerData.amount !== payment.amountMinor || providerData.currency !== payment.currency) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Payment verification mismatch");
    // Closes the current block.
    }

    // Defines successful using the value on the right-hand side.
    const successful = providerData.status === "success";
    // Stores the result of mongoose.startSession in session.
    const session = await mongoose.startSession();
    // Starts an operation whose errors are handled below.
    try {
      // Waits for session.withTransaction to finish before continuing.
      await session.withTransaction(async () => {
        // Stores the result of this.repository.findCurrentPayment in current.
        const current = await this.repository.findCurrentPayment(payment._id, session);
        // Runs the following branch when !current || current.status === PaymentStatus.SUCCESSFUL is true.
        if (!current || current.status === PaymentStatus.SUCCESSFUL) return;
        // Updates current.status with the value on the right-hand side.
        current.status = successful ? PaymentStatus.SUCCESSFUL : PaymentStatus.FAILED;
        // Updates current.providerTransactionId with the value on the right-hand side.
        current.providerTransactionId = providerData.id?.toString();
        // Updates current.failureMessage with the value on the right-hand side.
        current.failureMessage = successful ? undefined : providerData.gateway_response;
        // Updates current.processedAt with the value on the right-hand side.
        current.processedAt = new Date();
        // Updates current.metadata with the value on the right-hand side.
        current.metadata = { providerStatus: providerData.status };
        // Waits for repository.savePayment to finish before continuing.
        await this.repository.savePayment(current, session);

        // Runs the following branch when successful is true.
        if (successful) {
          // Stores the result of this.repository.findPlanById in plan.
          const plan = await this.repository.findPlanById(current.plan, session);
          // Runs the following branch when !plan) throw new NotFoundError("Plan not found" is true.
          if (!plan) throw new NotFoundError("Plan not found");
          // Waits for repository.updatePlanAfterPayment to finish before continuing.
          await this.repository.updatePlanAfterPayment(plan._id, current.amountMinor, addOneMonthPreservingBillingDay(new Date()), session);
          // Runs the following branch when providerData.authorization?.authorization_code && providerData.authorization.reusable is true.
          if (providerData.authorization?.authorization_code && providerData.authorization.reusable) {
            // Waits for repository.upsertAuthorization to finish before continuing.
            await this.repository.upsertAuthorization(
              // Opens the block for the declaration or control flow above.
              { plan: current.plan, authorizationCode: providerData.authorization.authorization_code },
              // Opens the block for the declaration or control flow above.
              {
                  // Declares the owner property with type or value current.owner,.
                  owner: current.owner,
                  // Declares the plan property with type or value current.plan,.
                  plan: current.plan,
                  // Declares the provider property with type or value "paystack",.
                  provider: "paystack",
                  // Declares the authorizationCode property with type or value providerData.authorization.authorization_code,.
                  authorizationCode: providerData.authorization.authorization_code,
                  // Declares the customerCode property with type or value providerData.customer?.customer_code,.
                  customerCode: providerData.customer?.customer_code,
                  // Declares the customerEmail property with type or value providerData.customer?.email || "",.
                  customerEmail: providerData.customer?.email || "",
                  // Declares the reusable property with type or value Boolean(providerData.authorization.reusable),.
                  reusable: Boolean(providerData.authorization.reusable),
                  // Declares the channel property with type or value providerData.authorization.channel,.
                  channel: providerData.authorization.channel,
                  // Declares the cardType property with type or value providerData.authorization.card_type,.
                  cardType: providerData.authorization.card_type,
                  // Declares the bank property with type or value providerData.authorization.bank,.
                  bank: providerData.authorization.bank,
                  // Declares the last4 property with type or value providerData.authorization.last4,.
                  last4: providerData.authorization.last4,
                  // Declares the expMonth property with type or value providerData.authorization.exp_month,.
                  expMonth: providerData.authorization.exp_month,
                  // Declares the expYear property with type or value providerData.authorization.exp_year,.
                  expYear: providerData.authorization.exp_year,
                  // Declares the active property with type or value true,.
                  active: true,
              // Closes the current block.
              }, session);
          // Closes the current block.
          }
        // Closes the current block.
        }
      // Closes the current block.
      });
    // Closes the current block.
    } finally {
      // Waits for session.endSession to finish before continuing.
      await session.endSession();
    // Closes the current block.
    }

    // Stores the result of this.repository.findById in updated.
    const updated = await this.repository.findById(payment._id);
    // Runs the following branch when !updated) throw new NotFoundError("Payment not found" is true.
    if (!updated) throw new NotFoundError("Payment not found");
    // Defines event using the value on the right-hand side.
    const event = updated.purpose === PaymentPurpose.INITIAL
      // Provides the next part of the surrounding operation.
      ? (successful ? NotificationEvent.INITIAL_PAYMENT_SUCCESS : NotificationEvent.INITIAL_PAYMENT_FAILURE)
      // Provides the next part of the surrounding operation.
      : (successful ? NotificationEvent.RECURRING_PAYMENT_SUCCESS : NotificationEvent.RECURRING_PAYMENT_FAILURE);
    // Provides the next part of the surrounding operation.
    await new NotificationService().record(updated.owner.toString(), updated.plan.toString(), event, `${updated._id}:${event}`);

    // Runs the following branch when successful && updated.purpose === PaymentPurpose.INITIAL is true.
    if (successful && updated.purpose === PaymentPurpose.INITIAL) {
      // Provides the next part of the surrounding operation.
      await new BillingScheduleService().activateForPlan(updated.plan, addOneMonthPreservingBillingDay(new Date()));
    // Closes the current block.
    }
    // Returns updated to the caller.
    return updated;
  // Closes the current block.
  }

  // Validates and processes a payment provider webhook.
  // Declares a function or method used by this service.
  async processWebhook(payload: any, rawBody: Buffer | undefined, signature: string | string[] | undefined): Promise<{ status: string }> {
    // Stores the result of PaystackService in paystack.
    const paystack = new PaystackService();
    // Runs the following branch when !paystack.verifySignature(rawBody, signature) is true.
    if (!paystack.verifySignature(rawBody, signature)) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Invalid Paystack signature");
    // Closes the current block.
    }
    // Defines reference using the value on the right-hand side.
    const reference = payload?.data?.reference;
    // Stores the result of uuidv4 in eventKey.
    const eventKey = `${payload?.event || "unknown"}:${reference || payload?.data?.id || uuidv4()}`;
    // Stores the result of this.repository.createPaystackEvent in event.
    const event = await this.repository.createPaystackEvent(eventKey, payload?.event || "unknown", reference);
    // Runs the following branch when !event || event.status === "Processed" || event.status === "Ignored" is true.
    if (!event || event.status === "Processed" || event.status === "Ignored") return { status: "duplicate" };

    // Starts an operation whose errors are handled below.
    try {
      // Runs the following branch when payload.event === "charge.success" && reference is true.
      if (payload.event === "charge.success" && reference) {
        // Waits for verifyAndApply to finish before continuing.
        await this.verifyAndApply(reference);
        // Updates event.status with the value on the right-hand side.
        event.status = "Processed";
      // Closes the current block.
      } else if (payload.event === "charge.failed" && reference) {
        // Waits for repository.markProviderFailure to finish before continuing.
        await this.repository.markProviderFailure(reference, payload?.data?.gateway_response);
        // Updates event.status with the value on the right-hand side.
        event.status = "Processed";
      // Closes the current block.
      } else {
        // Updates event.status with the value on the right-hand side.
        event.status = "Ignored";
      // Closes the current block.
      }
      // Waits for repository.savePaystackEvent to finish before continuing.
      await this.repository.savePaystackEvent(event);
      // Returns { status: event.status } to the caller.
      return { status: event.status };
    // Closes the current block.
    } catch (error: any) {
      // Updates event.status with the value on the right-hand side.
      event.status = "Failed";
      // Updates event.errorMessage with the value on the right-hand side.
      event.errorMessage = error.message;
      // Waits for repository.savePaystackEvent to finish before continuing.
      await this.repository.savePaystackEvent(event);
      // Provides the next part of the surrounding operation.
      throw error;
    // Closes the current block.
    }
  // Closes the current block.
  }

  // Returns records belonging to the specified owner.
  // Declares a function or method used by this service.
  async listForOwner(ownerId: string): Promise<IPayment[]> {
    // Returns this.repository.listForOwner(ownerId) to the caller.
    return this.repository.listForOwner(ownerId);
  // Closes the current block.
  }

  // Returns a record only when it belongs to the specified owner.
  // Declares a function or method used by this service.
  async getForOwner(paymentId: string, ownerId: string): Promise<IPayment> {
    // Stores the result of this.repository.findForOwner in payment.
    const payment = await this.repository.findForOwner(paymentId, ownerId);
    // Runs the following branch when !payment) throw new NotFoundError("Payment not found" is true.
    if (!payment) throw new NotFoundError("Payment not found");
    // Returns payment to the caller.
    return payment;
  // Closes the current block.
  }

  // Charges the saved authorization for a recurring billing schedule.
  // Declares a function or method used by this service.
  async chargeRecurring(schedule: IBillingSchedule): Promise<void> {
    // Stores the result of this.repository.findPlanById in plan.
    const plan = await this.repository.findPlanById(schedule.plan);
    // Runs the following branch when !plan || plan.status === PlanStatus.CANCELLED || plan.status === PlanStatus.COMPLETED is true.
    if (!plan || plan.status === PlanStatus.CANCELLED || plan.status === PlanStatus.COMPLETED) return;
    // Stores the result of this.repository.findReusableAuthorization in authorization.
    const authorization = await this.repository.findReusableAuthorization(plan._id);
    // Runs the following branch when !authorization) throw new BadRequestError("Reusable payment authorization is not avai is true.
    if (!authorization) throw new BadRequestError("Reusable payment authorization is not available for this plan");

    // Stores the result of this.repository.createPayment in payment.
    const payment = await this.repository.createPayment({
      // Declares the owner property with type or value plan.owner,.
      owner: plan.owner,
      // Declares the plan property with type or value plan._id,.
      plan: plan._id,
      // Declares the amountMinor property with type or value plan.contributionAmountMinor,.
      amountMinor: plan.contributionAmountMinor,
      // Declares the currency property with type or value plan.currency,.
      currency: plan.currency,
      // Declares the reference property with type or value this.reference("jh_rec"),.
      reference: this.reference("jh_rec"),
      // Declares the provider property with type or value PaymentProvider.PAYSTACK,.
      provider: PaymentProvider.PAYSTACK,
      // Declares the purpose property with type or value PaymentPurpose.RECURRING,.
      purpose: PaymentPurpose.RECURRING,
      // Declares the status property with type or value PaymentStatus.PROCESSING,.
      status: PaymentStatus.PROCESSING,
      // Declares the billingCycle property with type or value schedule.billingCycle,.
      billingCycle: schedule.billingCycle,
      // Declares the authorization property with type or value authorization._id,.
      authorization: authorization._id,
    // Closes the current block.
    });

    // Starts an operation whose errors are handled below.
    try {
      // Stores the result of PaystackService in result.
      const result = await new PaystackService().chargeAuthorization({
        // Declares the email property with type or value authorization.customerEmail,.
        email: authorization.customerEmail,
        // Declares the amount property with type or value payment.amountMinor,.
        amount: payment.amountMinor,
        // Declares the currency property with type or value payment.currency,.
        currency: payment.currency,
        // Declares the authorization_code property with type or value authorization.authorizationCode,.
        authorization_code: authorization.authorizationCode,
        // Declares the reference property with type or value payment.reference,.
        reference: payment.reference,
        // Declares the metadata property with type or value { planId: plan._id.toString(), paymentId: payment._id.toString(), bill.
        metadata: { planId: plan._id.toString(), paymentId: payment._id.toString(), billingCycle: schedule.billingCycle },
      // Closes the current block.
      });
      // Waits for applyProviderTransaction to finish before continuing.
      await this.applyProviderTransaction({ ...result, reference: result.reference || payment.reference });
      // Runs the following branch when result.status === "success" is true.
      if (result.status === "success") {
        // Provides the next part of the surrounding operation.
        await new BillingScheduleService().recordSuccess(schedule, payment._id);
      // Closes the current block.
      } else {
        // Provides the next part of the surrounding operation.
        await new BillingScheduleService().recordFailure(schedule, payment._id);
      // Closes the current block.
      }
    // Closes the current block.
    } catch (error: any) {
      // Waits for repository.updatePayment to finish before continuing.
      await this.repository.updatePayment(payment._id, { $set: { status: PaymentStatus.FAILED, failureMessage: error.message, processedAt: new Date() } });
      // Provides the next part of the surrounding operation.
      await new BillingScheduleService().recordFailure(schedule, payment._id);
    // Closes the current block.
    }
  // Closes the current block.
  }
// Closes the current block.
}
