import mongoose, { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { ConflictError } from "../../../common/errors/ConflictError";
import { UnauthorizedError } from "../../../common/errors/UnauthorizedError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { PlanStatus } from "../../plans/models/plan.model";
import {
  Notification,
  NotificationEvent,
} from "../../notifications/models/notification.model";
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
import { ISubscription } from "../../subscriptions/models/subscription.model";
import {
  PageOptions,
  pageResult,
  PaginatedResult,
} from "../../../common/utils/pagination";
import { env } from "@/config/application";
import { addOneMonthPreservingBillingDay } from "../../plans/services/date.service";
import crypto from "crypto";
import { logger } from "../../../common/logger/logger";
import { PaymentNotificationOutbox } from "../models/payment-notification-outbox.model";
import { PaystackEvent } from "../models/paystack-event.model";
import { Payment } from "../models/payment.model";
import { PaymentWorkerLease } from "../models/payment-worker-lease.model";
import { IPaymentCheckoutLock } from "../models/payment-checkout-lock.model";
import { PaymentCheckoutLock } from "../models/payment-checkout-lock.model";

const MAX_NOTIFICATION_ATTEMPTS = 10;
const INITIAL_CHECKOUT_URL_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
const COMPLETED_RECORD_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

interface PaystackWebhookPayload {
  event: string;
  data?: {
    reference?: string;
    id?: string | number;
    gateway_response?: string;
    customer?: { customer_code?: string; email?: string } | number;
    plan?: { plan_code?: string } | number;
    subscription_code?: string;
    subscription?: { subscription_code?: string; next_payment_date?: string };
    next_payment_date?: string;
    createdAt?: string;
    status?: string;
    invoice_code?: string;
    amount?: number;
    currency?: string;
    description?: string;
  };
}

export class PaymentService {
  // Repositories own database queries; this service coordinates them with Paystack and business rules.
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
    alreadyPaid?: boolean;
  }> {
    // Serialize checkout creation per plan, so two Render instances cannot create parallel replacements.
    const lockKey = `initial:${planId}`;
    const lock = await this.acquireInitialCheckoutLock(lockKey);
    try {
      return await this.initializeInitialCheckoutWithLock(
        planId,
        ownerId,
        lock,
      );
    } finally {
      // Release only this exact owner/version; if the lease was taken over, this cannot release the new owner's lock.
      try {
        await this.repository.releaseInitialCheckoutLock(lock);
      } catch (error) {
        // The lease still expires automatically, so a release outage must not hide a successfully created checkout.
        logger.warn(
          { error, planId, fencingVersion: lock.fencingVersion },
          "Could not release initial checkout lock",
        );
      }
    }
  }

  private async acquireInitialCheckoutLock(
    key: string,
  ): Promise<IPaymentCheckoutLock> {
    const ownerToken = uuidv4();
    const deadline = Date.now() + 25_000;
    // Briefly wait for another request to finish; every attempt is an atomic database claim.
    while (Date.now() < deadline) {
      const lock = await this.repository.acquireInitialCheckoutLock(
        key,
        ownerToken,
        new Date(),
      );
      if (lock) return lock;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new ConflictError(
      "Another checkout is being initialized; please retry shortly",
    );
  }

  private async initializeInitialCheckoutWithLock(
    planId: string,
    ownerId: string,
    lock: IPaymentCheckoutLock,
  ): Promise<{
    payment: IPayment;
    authorizationUrl: string;
    accessCode: string;
    reference: string;
    alreadyPaid?: boolean;
  }> {
    // Only the plan owner can start checkout, and the plan must exist before we can create a payment.
    const plan = await this.repository.findPlanForOwner(planId, ownerId);
    if (!plan) throw new NotFoundError("Plan not found");

    const existingPayment = await this.repository.findLatestInitialPayment(
      plan._id,
      ownerId,
    );

    // Measure URL lifetime from Paystack initialization; older records without this timestamp are unsafe to reuse.
    const checkoutInitializedAt =
      existingPayment?.metadata?.checkoutInitializedAt;
    const checkoutInitializedAtDate = checkoutInitializedAt
      ? new Date(
          checkoutInitializedAt instanceof Date
            ? checkoutInitializedAt.getTime()
            : (checkoutInitializedAt as string | number),
        )
      : undefined;
    const existingCheckoutExpiredByAge =
      !!existingPayment &&
      (!checkoutInitializedAtDate ||
        Number.isNaN(checkoutInitializedAtDate.getTime()) ||
        Date.now() - checkoutInitializedAtDate.getTime() >=
          INITIAL_CHECKOUT_URL_MAX_AGE_MS);
    let replaceExpiredCheckout = false;

    // A previous successful payment means checkout is complete. Return the saved payment instead of charging again.
    if (
      plan.status === PlanStatus.ACTIVE ||
      existingPayment?.status === PaymentStatus.SUCCESSFUL
    ) {
      if (existingPayment) {
        return {
          payment: existingPayment,
          authorizationUrl: "",
          accessCode: "",
          reference: existingPayment.reference,
          alreadyPaid: true,
        };
      }
    }

    // Initial payment is a setup step, so active/cancelled/etc. plans cannot begin it again.
    if (plan.status !== PlanStatus.PENDING) {
      throw new BadRequestError(
        "Initial checkout is only available for pending plans",
      );
    }

    // Paystack needs the owner's email and the package's Paystack plan code to initialize a subscription checkout.
    const user = await this.repository.findUserEmail(ownerId);
    if (!user?.email)
      throw new BadRequestError(
        "User email is required for payment initialization",
      );

    const pkg = await this.repository.findPlanPackage(plan.package);
    if (!pkg?.paystackPlanCode)
      throw new BadRequestError("Package is not configured for subscriptions");
    const subscriptions = new SubscriptionRepository();

    // Create the local subscription before contacting Paystack so later callbacks can be matched to this plan.
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

    // Reconcile an existing local checkout with Paystack before reusing it; local state may be stale after a callback failure.
    if (existingPayment) {
      const refToCheck =
        existingPayment.providerReference || existingPayment.reference;
      if (refToCheck) {
        let providerData: PaystackTransactionData | undefined;
        try {
          providerData = await new PaystackService().verifyTransaction(
            refToCheck,
          );
        } catch {
          // Reuse a young checkout during an outage; replace an expired URL even when verification fails.
          if (existingCheckoutExpiredByAge) replaceExpiredCheckout = true;
        }

        if (providerData) {
          // Apply every recognized provider status, then make decisions from the persisted local state.
          const applied = await this.applyProviderTransaction(providerData);
          const providerStatus = String(providerData.status).toLowerCase();
          if (applied.status === PaymentStatus.SUCCESSFUL) {
            return {
              payment: applied,
              authorizationUrl: "",
              accessCode: "",
              reference: applied.reference,
              alreadyPaid: true,
            };
          }
          if (providerStatus === "failed" || providerStatus === "reversed") {
            // Definitive failures cannot reuse the old checkout, even if its URL is younger than two days.
            replaceExpiredCheckout = true;
          } else if (existingCheckoutExpiredByAge) {
            // Replace old URLs for pending, abandoned, and processing transactions regardless of verification outcome.
            replaceExpiredCheckout = true;
          } else {
            // Refresh the in-memory document from the committed status before considering its saved URL reusable.
            existingPayment.status = applied.status;
            existingPayment.failureMessage = applied.failureMessage;
            existingPayment.processedAt = applied.processedAt;
            existingPayment.metadata = applied.metadata;
          }
        }
      } else if (existingCheckoutExpiredByAge) {
        // Without a provider reference, an old checkout cannot be verified, so replace its expired URL.
        replaceExpiredCheckout = true;
      }

      // Reuse the saved authorization URL only while it is inside the two-day validity window.
      const savedAuthUrl = existingPayment.metadata?.authorizationUrl as
        | string
        | undefined;

      const savedAccessCode =
        (existingPayment.metadata?.accessCode as string | undefined) || "";

      if (
        !replaceExpiredCheckout &&
        existingPayment.status !== PaymentStatus.FAILED &&
        savedAuthUrl
      ) {
        return {
          payment: existingPayment,
          authorizationUrl: savedAuthUrl,
          accessCode: savedAccessCode,
          reference:
            existingPayment.providerReference || existingPayment.reference,
          alreadyPaid: false,
        };
      }
    }

    // Reuse a pending record only when its checkout is still reusable; otherwise create a fresh payment record.
    const newOwnerId = new Types.ObjectId(ownerId);
    const replacingPayment = replaceExpiredCheckout
      ? existingPayment
      : undefined;
    let payment =
      existingPayment &&
      existingPayment.status === PaymentStatus.PENDING &&
      !replaceExpiredCheckout
        ? existingPayment
        : await this.repository.createInitialPaymentWithLock(lock, {
            owner: newOwnerId,
            plan: plan._id,
            amount: plan.amount,
            currency: plan.currency,
            reference: this.reference("jh_init"),
            providerReference: undefined,
            provider: PaymentProvider.PAYSTACK,
            purpose: PaymentPurpose.INITIAL,
            status: PaymentStatus.PENDING,
            metadata: replacingPayment
              ? { replacesPaymentId: replacingPayment._id.toString() }
              : undefined,
          });

    // Send IDs in Paystack metadata so callbacks can be matched to the exact local plan and payment.
    // Renew first because Paystack's request timeout is bounded and must fit inside this lock lease.
    if (!(await this.repository.renewInitialCheckoutLock(lock))) {
      throw new ConflictError(
        "Checkout initialization lock expired; please retry",
      );
    }
    const initialized = await new PaystackService().initializeTransaction({
      email: user.email,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      callback_url: env.PAYSTACK_CALLBACK_URL,
      plan: pkg.paystackPlanCode,
      metadata: {
        planId: plan._id.toString(),
        paymentId: payment._id.toString(),
        purpose: payment.purpose,
      },
    });

    // Save Paystack's reference and checkout details locally before returning the checkout link to the caller.
    const metadata = {
      ...(payment.metadata || {}),
      planId: plan._id.toString(),
      paymentId: payment._id.toString(),
      purpose: payment.purpose,
      authorizationUrl: initialized.authorization_url,
      accessCode: initialized.access_code,
      checkoutInitializedAt: new Date(),
    };

    // Commit Paystack's response and retire the old record under the same fencing check.
    const saved = await this.repository.saveInitializedInitialCheckout(
      lock,
      payment._id,
      initialized.reference,
      metadata,
      replacingPayment?._id,
    );
    payment.providerReference = initialized.reference;
    payment.status = saved.replacedPaymentSucceeded
      ? PaymentStatus.FAILED
      : PaymentStatus.PENDING;
    payment.metadata = metadata;
    if (saved.replacedPaymentSucceeded && saved.replacedPayment) {
      // A delayed success may have landed while Paystack initialized the replacement; never hand out the new URL then.
      return {
        payment: saved.replacedPayment,
        authorizationUrl: "",
        accessCode: "",
        reference: saved.replacedPayment.reference,
        alreadyPaid: true,
      };
    }

    return {
      payment,
      authorizationUrl: initialized.authorization_url,
      accessCode: initialized.access_code,
      reference: initialized.reference,
      alreadyPaid: false,
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
    // Validate the provider response before using any value to locate or mutate a local payment.
    if (
      typeof providerData.reference !== "string" ||
      !providerData.reference.trim()
    )
      throw new BadRequestError("Provider reference is missing or invalid");
    if (
      typeof providerData.amount !== "number" ||
      !Number.isSafeInteger(providerData.amount) ||
      providerData.amount <= 0 ||
      typeof providerData.currency !== "string" ||
      !/^[A-Z]{3}$/.test(providerData.currency)
    )
      throw new BadRequestError("Provider amount or currency is invalid");

    const payment = await this.repository.findByProviderReference(
      providerData.reference,
    );
    if (!payment) throw new NotFoundError("Payment not found");

    // The provider reference must identify the same exact charge amount and currency that we originally requested.
    if (
      providerData.amount !== payment.amount ||
      providerData.currency !== payment.currency
    ) {
      throw new BadRequestError("Payment verification mismatch");
    }

    // Map provider statuses into final outcomes and retryable/non-final outcomes explicitly.
    if (typeof providerData.status !== "string" || !providerData.status.trim())
      throw new BadRequestError("Provider transaction status is missing");
    const status = providerData.status.toLowerCase();
    const successful = status === "success";
    const definitiveFailure = status === "failed" || status === "reversed";
    const nonFinal =
      status === "pending" ||
      status === "abandoned" ||
      status === "ongoing" ||
      status === "processing" ||
      status === "queued";
    if (!successful && !definitiveFailure && !nonFinal)
      throw new BadRequestError(
        `Unsupported Paystack transaction status: ${providerData.status}`,
      );
    // Successful payments are immutable here: a later reversal is recorded for manual reconciliation, not silently undone.
    if (payment.status === PaymentStatus.SUCCESSFUL) {
      if (status === "reversed") {
        await this.repository.updatePayment(payment._id, {
          $set: {
            "metadata.providerReversal": {
              detectedAt: new Date(),
              status,
              gatewayResponse: providerData.gateway_response,
            },
          },
        });
        logger.error(
          {
            paymentId: payment._id.toString(),
            reference: providerData.reference,
          },
          "Paystack reversed a previously successful payment; manual reconciliation is required",
        );
      }
      return payment;
    }
    if (nonFinal) {
      // Pending-like statuses update provider details without applying plan contributions or emitting final notifications.
      const nextStatus =
        status === "pending" || status === "abandoned"
          ? PaymentStatus.PENDING
          : PaymentStatus.PROCESSING;
      const changed = await this.repository.updateNonFinalProviderStatus(
        payment._id,
        nextStatus,
        {
          providerTransactionId: providerData.id?.toString(),
          metadata: {
            ...(payment.metadata || {}),
            providerStatus: providerData.status,
          },
        },
        status === "abandoned" && payment.purpose === PaymentPurpose.INITIAL,
      );
      return (
        changed || (await this.repository.findById(payment._id)) || payment
      );
    }
    const subscriptions = new SubscriptionRepository();
    const session = await mongoose.startSession();
    let reconciliationRequired = false;

    // Final payment state, plan totals/dates, subscription state, and notification intent must commit together.
    try {
      await session.withTransaction(async () => {
        // Reset this flag because MongoDB may retry the transaction callback after a write conflict.
        reconciliationRequired = false;
        // Re-read inside the transaction because a webhook and frontend verification may race on this same payment.
        const current = await this.repository.findCurrentPayment(
          payment._id,
          session,
        );
        if (!current || current.status === PaymentStatus.SUCCESSFUL) return;
        const nextStatus = successful
          ? PaymentStatus.SUCCESSFUL
          : PaymentStatus.FAILED;
        // Prefer Paystack's payment timestamp; use server time only when the provider omitted an invalid date.
        const providerDateRaw = providerData.paid_at || providerData.created_at;
        const providerDate = providerDateRaw
          ? new Date(providerDateRaw)
          : undefined;
        const paymentDate =
          providerDate && !Number.isNaN(providerDate.getTime())
            ? providerDate
            : new Date();
        const updated = await this.repository.claimPaymentTransition(
          payment._id,
          nextStatus,
          {
            providerTransactionId: providerData.id?.toString(),
            failureMessage: successful
              ? undefined
              : providerData.gateway_response ||
                `Paystack transaction ${status}`,
            processedAt: paymentDate,
            metadata: {
              ...(current.metadata || {}),
              providerStatus: providerData.status,
            },
          },
          session,
        );
        if (!updated) return;

        if (successful) {
          // Only one initial payment can claim the plan's first contribution, even if two references succeed.
          const plan = await this.repository.findPlanById(
            current.plan,
            session,
          );
          if (!plan) throw new NotFoundError("Plan not found");

          // Prefer Paystack's next billing date; otherwise advance from the confirmed payment date.
          const providerNextDate = providerData.next_payment_date
            ? new Date(providerData.next_payment_date)
            : undefined;
          const nextPaymentDate =
            providerNextDate && !Number.isNaN(providerNextDate.getTime())
              ? providerNextDate
              : addOneMonthPreservingBillingDay(paymentDate);

          let shouldActivateSubscription =
            updated.purpose === PaymentPurpose.RECURRING;
          if (updated.purpose === PaymentPurpose.INITIAL) {
            // Detect older successful records too, because pre-migration plans have no initialPaymentId yet.
            const otherSuccess =
              await this.repository.findOtherSuccessfulInitialPayment(
                plan._id,
                updated._id,
                session,
              );
            const alreadyClaimedBy = plan.initialPaymentId;
            const initialSlotAlreadyTaken =
              !!otherSuccess ||
              (!!alreadyClaimedBy && !alreadyClaimedBy.equals(updated._id));

            if (initialSlotAlreadyTaken) {
              reconciliationRequired = true;
              // Preserve the real successful charge, but don't count or activate a second initial contribution.
              const winningPaymentId = otherSuccess?._id || alreadyClaimedBy;
              await this.repository.updatePayment(
                updated._id,
                {
                  $set: {
                    "metadata.manualReconciliationRequired": true,
                    "metadata.reconciliationReason":
                      "multiple_successful_initial_payments",
                    ...(winningPaymentId
                      ? { "metadata.winningInitialPaymentId": winningPaymentId }
                      : {}),
                  },
                },
                session,
              );
              logger.error(
                {
                  paymentId: updated._id.toString(),
                  planId: plan._id.toString(),
                  winningPaymentId: winningPaymentId?.toString(),
                },
                "Multiple initial Paystack payments succeeded; the extra charge requires reconciliation",
              );
            } else {
              // This conditional plan update is the database-level exactly-once gate for the first contribution.
              const claim = await this.repository.claimInitialPlanPayment(
                plan._id,
                updated._id,
                updated.amount,
                nextPaymentDate,
                paymentDate,
                session,
              );
              if (claim.modifiedCount === 1) {
                shouldActivateSubscription = true;
                const replacementId = current.metadata?.replacedByPaymentId;
                if (
                  replacementId &&
                  Types.ObjectId.isValid(String(replacementId))
                ) {
                  // If this older checkout wins late, prevent its unpaid replacement from remaining payable locally.
                  await this.repository.supersedePendingReplacement(
                    new Types.ObjectId(String(replacementId)),
                    updated._id,
                    session,
                  );
                }
              } else {
                reconciliationRequired = true;
                // Another transaction may have claimed the plan between our read and conditional update.
                const latestPlan = await this.repository.findPlanById(
                  plan._id,
                  session,
                );
                const winningPaymentId = latestPlan?.initialPaymentId;
                await this.repository.updatePayment(
                  updated._id,
                  {
                    $set: {
                      "metadata.manualReconciliationRequired": true,
                      "metadata.reconciliationReason":
                        "initial_payment_claim_lost",
                      ...(winningPaymentId
                        ? {
                            "metadata.winningInitialPaymentId":
                              winningPaymentId,
                          }
                        : {}),
                    },
                  },
                  session,
                );
                logger.error(
                  {
                    paymentId: updated._id.toString(),
                    planId: plan._id.toString(),
                    winningPaymentId: winningPaymentId?.toString(),
                  },
                  "Initial payment succeeded but could not claim the plan contribution; reconciliation is required",
                );
              }
            }
          } else {
            // Recurring payments continue to add a contribution after the initial payment established the plan.
            await this.repository.updatePlanAfterPayment(
              plan._id,
              updated.amount,
              nextPaymentDate,
              paymentDate,
              session,
            );
          }

          if (shouldActivateSubscription) {
            const sub = await subscriptions.findByPlan(updated.plan, session);
            // Keep the subscription schedule aligned with the confirmed payment and plan schedule.
            if (sub) {
              if (sub.status === SubscriptionStatus.PENDING) {
                sub.status = SubscriptionStatus.ACTIVE;
              }
              sub.lastPaymentAt = paymentDate;
              sub.nextPaymentDate = nextPaymentDate;
              await sub.save({ session });
            }
          }
        }
        // Store a durable notification instruction in the same transaction, so a committed payment cannot lose its notice.
        const event =
          updated.purpose === PaymentPurpose.INITIAL
            ? successful
              ? NotificationEvent.INITIAL_PAYMENT_SUCCESS
              : NotificationEvent.INITIAL_PAYMENT_FAILURE
            : successful
              ? NotificationEvent.RECURRING_PAYMENT_SUCCESS
              : NotificationEvent.RECURRING_PAYMENT_FAILURE;
        const amount = new Intl.NumberFormat("en-NG", {
          style: "currency",
          currency: updated.currency,
        }).format(updated.amount / 100);
        const notificationTitle = reconciliationRequired
          ? "Payment received; reconciliation required"
          : successful
            ? updated.purpose === PaymentPurpose.INITIAL
              ? "Initial contribution confirmed"
              : "Plan contribution received"
            : updated.purpose === PaymentPurpose.INITIAL
              ? "Initial contribution needs attention"
              : "Scheduled contribution could not be collected";
        const notificationMessage = reconciliationRequired
          ? `${amount} was received, but another initial payment already claimed this plan. The extra charge is being reviewed; your total contribution was not increased twice.`
          : successful
            ? `${amount} was confirmed for your plan. Your contribution history has been updated.`
            : `We could not confirm ${amount} for your plan. Please review the payment status or contact support if you need help.`;
        await PaymentNotificationOutbox.updateOne(
          { dedupeKey: `${updated._id}:${event}` },
          {
            $setOnInsert: {
              dedupeKey: `${updated._id}:${event}`,
              userId: updated.owner,
              event,
              title: notificationTitle,
              message: notificationMessage,
              status: "Pending",
              attempts: 0,
              emailStatus: "Pending",
              inAppStatus: "Pending",
            },
          },
          { upsert: true, session },
        );
      });
    } finally {
      // Release the session whether the transaction succeeds or fails.
      await session.endSession();
    }

    const updated = await this.repository.findById(payment._id);
    if (!updated) throw new NotFoundError("Payment not found");

    return updated;
  }

  // Validates and processes a Paystack webhook, recording its outcome for retry and deduplication.
  async processWebhook(
    payload: PaystackWebhookPayload,
    rawBody: Buffer | undefined,
    signature: string | string[] | undefined,
    timestampedSignature?: string | string[] | undefined,
  ): Promise<{ status: string }> {
    const paystack = new PaystackService();
    // Reject untrusted requests before saving anything for asynchronous processing.
    if (!paystack.verifySignature(rawBody, signature, timestampedSignature)) {
      throw new UnauthorizedError("Invalid Paystack signature");
    }
    if (
      !payload ||
      typeof payload.event !== "string" ||
      !payload.event.trim() ||
      (payload.data !== undefined &&
        (!payload.data ||
          typeof payload.data !== "object" ||
          Array.isArray(payload.data)))
    ) {
      throw new BadRequestError("Invalid Paystack webhook payload");
    }

    // Build a stable deduplication key from provider identifiers; hash the raw body as a fallback.
    const data = payload.data || {};
    const reference =
      typeof data.reference === "string" ? data.reference : undefined;
    const stableId =
      reference ||
      (data.id !== undefined ? String(data.id) : undefined) ||
      data.invoice_code ||
      data.subscription_code ||
      data.subscription?.subscription_code;
    const eventKey = `${payload.event}:${stableId || crypto.createHash("sha256").update(rawBody!).digest("hex")}`;
    // Store only fields needed by supported handlers, then acknowledge quickly; a worker processes the durable row.
    const safePayload = this.sanitizeWebhookPayload(payload);

    await this.repository.createPaystackEvent(
      eventKey,
      payload.event,
      reference,
      safePayload,
    );

    return { status: "accepted" };
  }

  private sanitizeWebhookPayload(
    payload: PaystackWebhookPayload,
  ): Record<string, unknown> {
    // Normalize absent data to an empty object and whitelist nested object fields before persistence.
    const data = payload.data || {};
    const pickObject = (value: unknown, keys: string[]) => {
      if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
      const source = value as Record<string, unknown>;
      return Object.fromEntries(
        keys
          .filter((key) => source[key] !== undefined)
          .map((key) => [key, source[key]]),
      );
    };
    return {
      event: payload.event,
      data: {
        reference: data.reference,
        id: data.id,
        gateway_response: data.gateway_response,
        customer: pickObject(data.customer, ["customer_code", "email"]),
        plan: pickObject(data.plan, ["plan_code"]),
        subscription_code: data.subscription_code,
        subscription: pickObject(data.subscription, [
          "subscription_code",
          "next_payment_date",
        ]),
        next_payment_date: data.next_payment_date,
        createdAt: data.createdAt,
        status: data.status,
        invoice_code: data.invoice_code,
        amount: data.amount,
        currency: (data as Record<string, unknown>).currency,
        description: data.description,
      },
    };
  }

  async processNextWebhookEvent(): Promise<boolean> {
    // Atomically claim one eligible event with a lease so competing app instances cannot process it simultaneously.
    const now = new Date();
    const lockToken = uuidv4();
    const event = await this.repository.claimPaystackEvent(
      now,
      new Date(now.getTime() + 120_000),
      lockToken,
    );
    if (!event) return false;
    logger.info(
      {
        eventKey: event.eventKey,
        event: event.event,
        reference: event.reference,
        attempt: event.attempts,
      },
      "WEBHOOK_WORKER: Claimed event from queue for processing",
    );
    // A malformed stored row cannot be replayed safely; mark it for operator reconciliation instead of retrying forever.
    if (!event.payload || typeof event.payload.event !== "string") {
      await this.repository.finishPaystackEvent(
        event._id,
        lockToken,
        "Exhausted",
        "Stored webhook has no replayable payload; manual reconciliation is required",
      );
      logger.error(
        { eventKey: event.eventKey },
        "Paystack webhook record cannot be replayed and requires reconciliation",
      );
      return true;
    }
    try {
      // Event handlers throw on retryable/unmatched cases; only a completed handler gets a terminal success state.
      const result = await this.processVerifiedWebhook(
        event.payload as unknown as PaystackWebhookPayload,
      );
      await this.repository.finishPaystackEvent(
        event._id,
        lockToken,
        result === "Ignored" ? "Ignored" : "Processed",
      );
      logger.info(
        {
          eventKey: event.eventKey,
          event: event.event,
          reference: event.reference,
          outcome: result,
        },
        "WEBHOOK_WORKER: Finished processing event successfully",
      );
    } catch (error: unknown) {
      // Back off repeated failures and stop after 20 claims, leaving an exhausted row visible for reconciliation.
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = event.attempts >= 20;
      const delayMs = Math.min(
        60_000 * 2 ** Math.min(event.attempts - 1, 6),
        3_600_000,
      );
      if (exhausted)
        logger.error(
          {
            eventKey: event.eventKey,
            attempts: event.attempts,
            error: message,
          },
          "Paystack webhook exhausted retries and requires reconciliation",
        );
      await this.repository.finishPaystackEvent(
        event._id,
        lockToken,
        exhausted ? "Exhausted" : "Failed",
        message,
        exhausted ? undefined : new Date(Date.now() + delayMs),
      );
    }
    return true;
  }

  async processNextPaymentNotification(): Promise<boolean> {
    // Claim one ready or lease-expired notification. The atomic update increments attempts and prevents duplicate workers.
    const now = new Date();
    const lockToken = uuidv4();
    const item = await PaymentNotificationOutbox.findOneAndUpdate(
      {
        $or: [
          {
            status: "Pending",
            attempts: { $lt: MAX_NOTIFICATION_ATTEMPTS },
            $or: [
              { nextAttemptAt: { $exists: false } },
              { nextAttemptAt: { $lte: now } },
            ],
          },
          {
            status: "Failed",
            attempts: { $lt: MAX_NOTIFICATION_ATTEMPTS },
            $or: [
              { nextAttemptAt: { $exists: false } },
              { nextAttemptAt: { $lte: now } },
            ],
          },
          { status: "Processing", leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "Processing",
          lockToken,
          leaseExpiresAt: new Date(now.getTime() + 120_000),
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    ).exec();
    if (!item) return false;
    // The retry limit is a safety cap; exhausted rows remain available for investigation.
    if (item.attempts > MAX_NOTIFICATION_ATTEMPTS) {
      await PaymentNotificationOutbox.updateOne(
        { _id: item._id, lockToken },
        {
          $set: { status: "Exhausted" },
          $unset: { lockToken: 1, leaseExpiresAt: 1, nextAttemptAt: 1 },
        },
      ).exec();
      logger.error(
        { outboxId: item._id.toString(), attempts: item.attempts },
        "Payment notification exceeded its retry limit and requires review",
      );
      return true;
    }
    try {
      // Track email and in-app delivery separately so a retry only repeats the channel that still needs work.
      const notifications = new NotificationService();
      const content = {
        userId: item.userId.toString(),
        event: item.event,
        dedupeKey: item.dedupeKey,
        title: item.title,
        message: item.message,
      };
      let emailStatus = item.emailStatus;
      // Email providers may fail or be disabled; persist the channel result before attempting in-app delivery.
      if (emailStatus === "Pending" || emailStatus === "Failed") {
        const result =
          await notifications.sendEmailNotificationWithResult(content);
        emailStatus =
          result === "sent"
            ? "Sent"
            : result === "skipped"
              ? "Skipped"
              : "Failed";
        await PaymentNotificationOutbox.updateOne(
          { _id: item._id, lockToken },
          { $set: { emailStatus } },
        ).exec();
      }
      // The notification service uses the dedupe key to make in-app creation safe to retry.
      if (item.inAppStatus !== "Sent") {
        await notifications.createInAppNotification(content);
        await PaymentNotificationOutbox.updateOne(
          { _id: item._id, lockToken },
          { $set: { inAppStatus: "Sent" } },
        ).exec();
      }
      if (emailStatus === "Failed")
        throw new Error("Payment notification email delivery failed");
      // Retain successful outbox rows temporarily for diagnostics, then let the TTL index clean them up.
      await PaymentNotificationOutbox.updateOne(
        { _id: item._id, lockToken },
        {
          $set: {
            status: "Sent",
            expiresAt: new Date(Date.now() + COMPLETED_RECORD_RETENTION_MS),
          },
          $unset: { lockToken: 1, leaseExpiresAt: 1, nextAttemptAt: 1 },
        },
      ).exec();
    } catch (error) {
      // Retry with capped exponential backoff; after the maximum attempts, require manual review instead.
      const delay = Math.min(
        60_000 * 2 ** Math.min(item.attempts - 1, 6),
        3_600_000,
      );
      await PaymentNotificationOutbox.updateOne(
        { _id: item._id, lockToken },
        {
          $set: {
            status:
              item.attempts >= MAX_NOTIFICATION_ATTEMPTS
                ? "Exhausted"
                : "Failed",
            ...(item.attempts < MAX_NOTIFICATION_ATTEMPTS
              ? { nextAttemptAt: new Date(Date.now() + delay) }
              : {}),
          },
          $unset: {
            lockToken: 1,
            leaseExpiresAt: 1,
            ...(item.attempts >= MAX_NOTIFICATION_ATTEMPTS
              ? { nextAttemptAt: 1 }
              : {}),
          },
        },
      ).exec();
      logger.error(
        { error, outboxId: item._id.toString() },
        item.attempts >= MAX_NOTIFICATION_ATTEMPTS
          ? "Payment notification exhausted retries and requires review"
          : "Payment notification delivery failed",
      );
    }
    return true;
  }

  private async processVerifiedWebhook(
    payload: PaystackWebhookPayload,
  ): Promise<"Processed" | "Ignored"> {
    // This method runs only after signature verification and durable event claiming have happened.
    const reference = payload.data?.reference;
    const event = {
      status: "Processing" as "Processing" | "Processed" | "Ignored",
    };

    try {
      if (payload.event === "subscription.create") {
        // Link Paystack's subscription to exactly one pending local subscription using customer and plan identifiers.
        const data = payload.data || {};

        const customer =
          data.customer && typeof data.customer === "object"
            ? data.customer
            : {};

        const providerPlan =
          data.plan && typeof data.plan === "object" ? data.plan : {};
        if (
          (customer.customer_code !== undefined &&
            typeof customer.customer_code !== "string") ||
          (customer.email !== undefined &&
            typeof customer.email !== "string") ||
          (providerPlan.plan_code !== undefined &&
            typeof providerPlan.plan_code !== "string")
        )
          throw new BadRequestError(
            "Paystack subscription customer or plan data is invalid",
          );

        const existing = data.subscription_code
          ? await new SubscriptionRepository().findByProviderCode(
              data.subscription_code,
            )
          : null;
        const ownerRecord = customer.customer_code
          ? await this.repository.findOwnerByProviderCustomerCode(
              customer.customer_code,
            )
          : null;
        const matchedOwnerId =
          ownerRecord?.owner ||
          (customer.email
            ? (await this.repository.findOwnerByEmail(customer.email))?._id
            : null);

        const candidates =
          !existing && matchedOwnerId && providerPlan.plan_code
            ? await new SubscriptionRepository().findPendingForOwnerPlanCode(
                matchedOwnerId,
                providerPlan.plan_code,
              )
            : [];

        if (candidates.length > 1)
          throw new BadRequestError(
            "Paystack subscription cannot be matched to a unique pending Journey Home plan",
          );

        const pending = candidates[0];

        if (
          data.subscription_code !== undefined &&
          typeof data.subscription_code !== "string"
        )
          throw new BadRequestError("Paystack subscription code is invalid");
        const matchedSubscription = existing || pending;
        if (!matchedSubscription || !data.subscription_code)
          throw new BadRequestError(
            "Paystack subscription cannot yet be matched to a local pending plan",
          );
        const next = data.next_payment_date
          ? new Date(data.next_payment_date)
          : matchedSubscription.nextPaymentDate;
        const startedAt =
          matchedSubscription.startedAt ||
          (data.createdAt ? new Date(data.createdAt) : new Date());
        if (
          (next && Number.isNaN(next.getTime())) ||
          Number.isNaN(startedAt.getTime())
        )
          throw new BadRequestError(
            "Paystack subscription schedule date is invalid",
          );

        await new SubscriptionRepository().attachProvider({
          id: matchedSubscription._id,
          code: data.subscription_code,
          customerCode:
            typeof customer.customer_code === "string"
              ? customer.customer_code
              : matchedSubscription.providerCustomerCode,
          nextPaymentDate: next,
          startedAt,
        });
        if (next)
          await this.repository.updatePlanNextPaymentDate(
            matchedSubscription.plan,
            next,
          );
        event.status = "Processed";
      } else if (payload.event === "charge.success") {
        logger.info(
          { event: payload.event, reference, amount: payload.data?.amount },
          "WEBHOOK_HANDLER: Handling charge.success",
        );
        // Charge success is the authoritative event for applying an initial or recurring payment.
        if (!reference || !payload.data)
          throw new BadRequestError(
            "Paystack successful charge is missing its reference or data",
          );
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
        // Invoice/subscription lifecycle events update schedules and subscription state, not plan lifecycle state.
        const data = payload.data || {};

        const code =
          data.subscription?.subscription_code || data.subscription_code;

        const local = code
          ? await new SubscriptionRepository().findByProviderCode(code)
          : null;
        if (local) {
          let invoicePlan;
          // A failed invoice is persisted as a separate recurring payment, so validate its invoice identity and value first.
          if (payload.event === "invoice.payment_failed") {
            if (!data.invoice_code)
              throw new BadRequestError(
                "Failed Paystack invoice is missing its invoice code",
              );
            invoicePlan = await this.repository.findPlanById(local.plan);
            if (!invoicePlan)
              throw new NotFoundError("Plan not found for Paystack invoice");
            if (
              typeof data.amount !== "number" ||
              !Number.isSafeInteger(data.amount) ||
              data.amount < 1 ||
              data.currency !== invoicePlan.currency
            )
              throw new BadRequestError(
                "Paystack invoice amount or currency is invalid",
              );
          }
          const nextDate =
            data.subscription?.next_payment_date || data.next_payment_date;

          if (nextDate) {
            // Paystack schedule updates are copied to both subscription and plan for consistent display.
            local.nextPaymentDate = new Date(nextDate);
            if (Number.isNaN(local.nextPaymentDate.getTime()))
              throw new BadRequestError(
                "Paystack subscription schedule date is invalid",
              );
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
              data.status?.toLowerCase() === "complete"
                ? SubscriptionStatus.COMPLETED
                : SubscriptionStatus.CANCELLED;
            if (local.status === SubscriptionStatus.CANCELLED)
              local.cancelledAt = new Date();
          }

          await local.save();

          // Invoice IDs are not transaction references; prefix them to keep this record in a separate identifier namespace.
          if (
            payload.event === "invoice.payment_failed" &&
            invoicePlan &&
            data.invoice_code
          ) {
            await this.repository.upsertFailedInvoicePayment({
              owner: local.owner,
              plan: local.plan,
              amount: data.amount!,
              currency: data.currency!,
              reference: `paystack_invoice_${data.invoice_code}`,
              providerReference: `invoice:${data.invoice_code}`,
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
        } else
          throw new BadRequestError(
            "Paystack subscription is not linked locally; reconciliation is required",
          );
        event.status = "Processed";
      } else if (payload.event === "charge.failed") {
        // Treat charge.failed as supplemental information; never overwrite a payment already recorded as successful.
        if (!reference)
          throw new BadRequestError(
            "Failed Paystack charge is missing its reference",
          );
        const result = await this.repository.markProviderFailure(
          reference,
          payload?.data?.gateway_response,
        );
        if (!result.matchedCount) {
          const known =
            await this.repository.findByProviderReference(reference);
          if (known?.status !== PaymentStatus.SUCCESSFUL)
            throw new BadRequestError(
              "Failed charge has no matching local payment; reconciliation is required",
            );
        }
        event.status = "Processed";
      } else {
        // Unsupported events are intentionally ignored and acknowledged so Paystack will not retry them.
        event.status = "Ignored";
      }

      return event.status;
    } catch (error: unknown) {
      // Bubble failures to the queue processor, which records retry timing and eventual exhaustion.
      throw error;
    }
  }

  private async applyChargeSuccess(
    data: NonNullable<PaystackWebhookPayload["data"]>,
  ): Promise<void> {
    // Existing references belong to a known payment, so verify and apply them through the standard idempotent path.
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
    // Unknown charge references are considered recurring only after Paystack verification ties them to this subscription.
    const providerData = await new PaystackService().verifyTransaction(
      reference,
    );
    const verifiedCode =
      typeof providerData.subscription_code === "string"
        ? providerData.subscription_code
        : undefined;
    const verifiedPlanCode =
      providerData.plan && typeof providerData.plan === "object"
        ? providerData.plan.plan_code
        : undefined;
    if (
      verifiedCode !== subscription.providerSubscriptionCode &&
      verifiedPlanCode !== subscription.providerPlanCode
    ) {
      throw new BadRequestError(
        "Verified charge does not identify the linked recurring subscription; reconciliation is required",
      );
    }
    await this.createAndApplyRecurring(providerData, subscription);
  }

  private async createAndApplyRecurring(
    data: PaystackTransactionData,
    subscription: ISubscription,
  ) {
    // A recurring payment row is created only from a verified success matching the linked plan's value.
    if (data.status?.toLowerCase() !== "success")
      throw new BadRequestError(
        "Recurring payment can only be created for a verified successful transaction",
      );
    if (!data.reference || !Number.isSafeInteger(data.amount) || !data.currency)
      throw new BadRequestError("Incomplete Paystack transaction data");
    const plan = await this.repository.findPlanById(subscription.plan);
    if (!plan) throw new NotFoundError("Plan not found");
    if (data.amount !== plan.amount || data.currency !== plan.currency)
      throw new BadRequestError(
        "Verified recurring transaction does not match the linked plan amount and currency",
      );
    const existing = await this.repository.findByProviderReference(
      data.reference,
    );
    if (existing) {
      // Duplicate webhook deliveries reuse the existing record, but a reference linked elsewhere is an integrity error.
      if (
        existing.plan.toString() !== subscription.plan.toString() ||
        existing.purpose !== PaymentPurpose.RECURRING
      )
        throw new BadRequestError(
          "Provider transaction is already linked to a different payment purpose or plan",
        );
      await this.applyProviderTransaction(data);
      return;
    }
    try {
      // A unique provider reference protects against simultaneous deliveries that both found no existing row.
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
    } catch (error) {
      // Treat a duplicate-key race as idempotent only if the winning row belongs to this same recurring plan.
      if ((error as { code?: number }).code !== 11000) throw error;
      const raced = await this.repository.findByProviderReference(
        data.reference,
      );
      if (
        !raced ||
        raced.plan.toString() !== subscription.plan.toString() ||
        raced.purpose !== PaymentPurpose.RECURRING
      )
        throw error;
    }
    await this.applyProviderTransaction(data);
  }

  async listForOwner(
    ownerId: string,
    options: PageOptions,
    filters: {
      status?: PaymentStatus;
      purpose?: PaymentPurpose;
      planId?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<PaginatedResult<IPayment>> {
    // Apply the repository's ownership and filter rules, then wrap results in the shared pagination response shape.
    const [items, total] = await this.repository.listForOwner(
      ownerId,
      options,
      filters,
    );
    return pageResult(items, total, options);
  }

  async listAll(
    options: PageOptions,
    filters: {
      status?: PaymentStatus;
      purpose?: PaymentPurpose;
      from?: Date;
      to?: Date;
      search?: string;
    },
  ) {
    // Admin listing includes aggregate totals alongside the paginated payment rows.
    const result = await this.repository.listAll(options, filters);
    return {
      ...pageResult(result.items as IPayment[], result.total, options),
      summary: result.summary,
    };
  }

  async getForOwner(paymentId: string, ownerId: string): Promise<IPayment> {
    // Scope lookup to the owner so one customer's payment ID cannot expose another customer's record.
    const payment = await this.repository.findForOwner(paymentId, ownerId);
    if (!payment) throw new NotFoundError("Payment not found");
    return payment;
  }
}

const PAYMENT_WORKER_LEASE_NAME = "paystack-webhook-and-notification-worker";
// Lease is longer than normal work batches, and is refreshed after each job to recover if a process dies.
const PAYMENT_WORKER_LEASE_MS = 90_000;

async function acquirePaymentWorkerLease(ownerToken: string): Promise<boolean> {
  // Take over only when the lease expired or this process already owns it.
  const now = new Date();
  const lease = await PaymentWorkerLease.findOneAndUpdate(
    {
      name: PAYMENT_WORKER_LEASE_NAME,
      $or: [{ ownerToken }, { expiresAt: { $lte: now } }],
    },
    {
      $set: {
        ownerToken,
        expiresAt: new Date(now.getTime() + PAYMENT_WORKER_LEASE_MS),
      },
    },
    { returnDocument: "after" },
  ).exec();
  if (lease) return true;
  try {
    // The unique lease name lets one process create the first lease; duplicate-key means another process won.
    await PaymentWorkerLease.create({
      name: PAYMENT_WORKER_LEASE_NAME,
      ownerToken,
      expiresAt: new Date(now.getTime() + PAYMENT_WORKER_LEASE_MS),
    });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}

async function renewPaymentWorkerLease(ownerToken: string): Promise<boolean> {
  // Renew only if the stored owner still matches; otherwise this worker must stop claiming jobs.
  const result = await PaymentWorkerLease.updateOne(
    { name: PAYMENT_WORKER_LEASE_NAME, ownerToken },
    { $set: { expiresAt: new Date(Date.now() + PAYMENT_WORKER_LEASE_MS) } },
  ).exec();
  return result.matchedCount === 1;
}

export function startPaystackWebhookWorker(): void {
  // The local flag prevents overlapping polls within this process; the Mongo lease coordinates across processes.
  let running = false;
  const ownerToken = uuidv4();
  const service = new PaymentService();
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      // Only the lease holder drains queues, in bounded batches, so polling does not monopolize the database.
      if (!(await acquirePaymentWorkerLease(ownerToken))) return;
      logger.info(
        { ownerToken },
        "WEBHOOK_POLL: Lease acquired, checking queue for pending events",
      );
      // Handle webhook events first so payment state changes and their outbox instructions are produced promptly.
      for (let count = 0; count < 25; count += 1) {
        if (!(await service.processNextWebhookEvent())) break;
        if (!(await renewPaymentWorkerLease(ownerToken))) return;
      }
      // Then send pending customer notifications created by the payment transactions.
      for (let count = 0; count < 25; count += 1) {
        if (!(await service.processNextPaymentNotification())) break;
        if (!(await renewPaymentWorkerLease(ownerToken))) return;
      }
    } catch (error) {
      // Keep a transient job/database error from terminating future polling cycles.
      logger.error({ error }, "Paystack webhook worker failed");
    } finally {
      running = false;
    }
  };
  // Run once during startup, then poll every 30 seconds to limit idle database reads.
  void poll();
  setInterval(() => void poll(), 30_000).unref();
}

export async function initializePaystackWebhookPersistence(): Promise<void> {
  // Create the outbox collection explicitly; code 48 means it already exists and is safe to continue.
  try {
    await PaymentNotificationOutbox.createCollection();
  } catch (error) {
    if ((error as { code?: number }).code !== 48) throw error;
  }
  // Ensure uniqueness and queue/TTL indexes exist before the worker starts claiming jobs.
  await PaystackEvent.createIndexes();
  await Payment.createIndexes();
  await PaymentNotificationOutbox.createIndexes();
  await PaymentWorkerLease.createIndexes();
  // Ensure the per-plan lock key is unique before requests attempt atomic checkout claims.
  await PaymentCheckoutLock.createIndexes();
  await Notification.createIndexes();
}
