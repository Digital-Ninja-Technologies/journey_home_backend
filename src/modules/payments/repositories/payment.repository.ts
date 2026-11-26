import mongoose, { ClientSession, Types } from "mongoose";
import { ConflictError } from "../../../common/errors/ConflictError";
import { User } from "../../auth/models/auth.model";
import {
  CoverageStatus,
  Plan,
  PlanStatus,
} from "../../plans/models/plan.model";
import {
  Payment,
  PaymentPurpose,
  PaymentStatus,
  IPayment,
} from "../models/payment.model";
import { PaystackEvent } from "../models/paystack-event.model";
import { Package } from "../../packages/models/package.model";
import { PageOptions, escapeRegex } from "../../../common/utils/pagination";
import { Subscription } from "../../subscriptions/models/subscription.model";
import {
  IPaymentCheckoutLock,
  PaymentCheckoutLock,
} from "../models/payment-checkout-lock.model";

export class PaymentRepository {
  private readonly checkoutLockLeaseMs = 60_000;

  async acquireInitialCheckoutLock(
    key: string,
    ownerToken: string,
    now: Date,
  ): Promise<IPaymentCheckoutLock | null> {
    try {
      // The expiry predicate and unique key make acquisition atomic across all API instances.
      return await PaymentCheckoutLock.findOneAndUpdate(
        {
          key,
          $or: [
            { leaseExpiresAt: { $lte: now } },
            { leaseExpiresAt: { $exists: false } },
          ],
        },
        {
          $set: {
            ownerToken,
            leaseExpiresAt: new Date(now.getTime() + this.checkoutLockLeaseMs),
          },
          $setOnInsert: { key },
          $inc: { fencingVersion: 1 },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ).exec();
    } catch (error) {
      // If another request owns the unexpired unique lock row, it won the acquisition race.
      if ((error as { code?: number }).code === 11000) return null;
      throw error;
    }
  }

  async renewInitialCheckoutLock(
    lock: IPaymentCheckoutLock,
    now = new Date(),
  ): Promise<boolean> {
    // The owner and fencing version must both match; an expired owner cannot renew after takeover.
    const renewed = await PaymentCheckoutLock.updateOne(
      {
        _id: lock._id,
        ownerToken: lock.ownerToken,
        fencingVersion: lock.fencingVersion,
        leaseExpiresAt: { $gt: now },
      },
      { $set: { leaseExpiresAt: new Date(now.getTime() + this.checkoutLockLeaseMs) } },
    ).exec();
    return renewed.matchedCount === 1;
  }

  async releaseInitialCheckoutLock(lock: IPaymentCheckoutLock): Promise<void> {
    // A stale request can only expire its own lock version, never the newer owner's lease.
    await PaymentCheckoutLock.updateOne(
      {
        _id: lock._id,
        ownerToken: lock.ownerToken,
        fencingVersion: lock.fencingVersion,
      },
      { $set: { leaseExpiresAt: new Date(0) } },
    ).exec();
  }

  async createInitialPaymentWithLock(
    lock: IPaymentCheckoutLock,
    data: Partial<IPayment>,
  ): Promise<IPayment> {
    const session = await mongoose.startSession();
    let created!: IPayment;
    try {
      await session.withTransaction(async () => {
        // Touching the lock in the same transaction fences off an expired owner before it can create a payment row.
        await this.touchInitialCheckoutLock(lock, session);
        const [payment] = await Payment.create([data], { session });
        created = payment;
      });
    } finally {
      await session.endSession();
    }
    return created;
  }

  async saveInitializedInitialCheckout(
    lock: IPaymentCheckoutLock,
    paymentId: Types.ObjectId,
    providerReference: string,
    metadata: Record<string, unknown>,
    replacedPaymentId?: Types.ObjectId,
  ): Promise<{ replacedPaymentSucceeded: boolean; replacedPayment?: IPayment }> {
    const session = await mongoose.startSession();
    let replacedPaymentSucceeded = false;
    let replacedPayment: IPayment | undefined;
    try {
      await session.withTransaction(async () => {
        // Persist the provider response only while this exact lock owner/version still holds a valid lease.
        await this.touchInitialCheckoutLock(lock, session);

        if (replacedPaymentId) {
          replacedPayment =
            (await Payment.findById(replacedPaymentId).session(session).exec()) ||
            undefined;
          replacedPaymentSucceeded =
            replacedPayment?.status === PaymentStatus.SUCCESSFUL;
        }

        // If the old charge won the race, retain the unused provider record for audit but do not offer its URL.
        await Payment.updateOne(
          { _id: paymentId },
          {
            $set: {
              providerReference,
              status: replacedPaymentSucceeded
                ? PaymentStatus.FAILED
                : PaymentStatus.PENDING,
              metadata: {
                ...metadata,
                ...(replacedPaymentSucceeded
                  ? { replacementSuppressedBySuccess: true }
                  : {}),
              },
              ...(replacedPaymentSucceeded
                ? {
                    failureMessage:
                      "Replacement checkout was not delivered because the previous payment succeeded",
                    processedAt: new Date(),
                  }
                : {}),
            },
          },
          { session },
        ).exec();

        if (replacedPaymentId && !replacedPaymentSucceeded) {
          const failureMessage =
            "Checkout expired; a replacement checkout was initialized";
          const retired = await Payment.updateOne(
            {
              _id: replacedPaymentId,
              purpose: PaymentPurpose.INITIAL,
              status: { $ne: PaymentStatus.SUCCESSFUL },
            },
            {
              $set: {
                status: PaymentStatus.FAILED,
                failureMessage,
                processedAt: new Date(),
                "metadata.replacedByPaymentId": paymentId,
                "metadata.replacedAt": new Date(),
              },
            },
            { session },
          ).exec();

          if (retired.matchedCount !== 1) {
            // Re-read after a failed conditional update to catch a success committed during replacement.
            replacedPayment =
              (await Payment.findById(replacedPaymentId)
                .session(session)
                .exec()) || undefined;
            replacedPaymentSucceeded =
              replacedPayment?.status === PaymentStatus.SUCCESSFUL;
            if (replacedPaymentSucceeded) {
              await Payment.updateOne(
                { _id: paymentId },
                {
                  $set: {
                    status: PaymentStatus.FAILED,
                    failureMessage:
                      "Replacement checkout was not delivered because the previous payment succeeded",
                    processedAt: new Date(),
                    "metadata.replacementSuppressedBySuccess": true,
                  },
                },
                { session },
              ).exec();
            }
          }
        }
      });
    } finally {
      await session.endSession();
    }
    return { replacedPaymentSucceeded, replacedPayment };
  }

  private async touchInitialCheckoutLock(
    lock: IPaymentCheckoutLock,
    session: ClientSession,
  ): Promise<void> {
    const now = new Date();
    const touched = await PaymentCheckoutLock.updateOne(
      {
        _id: lock._id,
        ownerToken: lock.ownerToken,
        fencingVersion: lock.fencingVersion,
        leaseExpiresAt: { $gt: now },
      },
      { $set: { leaseExpiresAt: new Date(now.getTime() + this.checkoutLockLeaseMs) } },
      { session },
    ).exec();
    if (touched.matchedCount !== 1)
      throw new ConflictError("Checkout initialization lock expired; please retry");
  }

  findPlanForOwner(planId: string, ownerId: string) {
    return Plan.findOne({ _id: planId, owner: ownerId }).exec();
  }

  findPlanById(planId: Types.ObjectId | string, session?: ClientSession) {
    return Plan.findById(planId)
      .session(session || null)
      .exec();
  }

  findUserEmail(ownerId: string) {
    return User.findById(ownerId).select("email").lean();
  }

  findOwnerByEmail(email?: string) {
    return email
      ? User.findOne({ email: email.toLowerCase() }).select("_id").lean()
      : null;
  }

  findOwnerByProviderCustomerCode(customerCode: string) {
    return Subscription.findOne({ providerCustomerCode: customerCode }).select("owner").lean();
  }

  findPlanPackage(packageId: Types.ObjectId | string) {
    return Package.findById(packageId).select("paystackPlanCode").exec();
  }

  updatePlanNextPaymentDate(planId: Types.ObjectId | string, date: Date) {
    return Plan.updateOne(
      { _id: planId },
      { $set: { nextPaymentDate: date } },
    ).exec();
  }

  findReusableInitial(plan: Types.ObjectId, owner: string) {
    return Payment.findOne({
      plan,
      owner,
      purpose: PaymentPurpose.INITIAL,
      status: PaymentStatus.PENDING,
    }).exec();
  }

  findLatestInitialPayment(plan: Types.ObjectId | string, owner: Types.ObjectId | string) {
    return Payment.findOne({
      plan,
      owner,
      purpose: PaymentPurpose.INITIAL,
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  createPayment(data: Partial<IPayment>) {
    return Payment.create(data);
  }

  updatePayment(
    id: Types.ObjectId | string,
    update: Record<string, unknown>,
    session?: ClientSession,
  ) {
    return Payment.updateOne({ _id: id }, update, { session }).exec();
  }

  async findByProviderReference(reference: string) {
    const exactProviderReference = await Payment.findOne({ providerReference: reference }).exec();
    if (exactProviderReference) return exactProviderReference;
    return Payment.findOne({ reference }).exec();
  }

  findById(id: Types.ObjectId | string) {
    return Payment.findById(id).exec();
  }

  findCurrentPayment(id: Types.ObjectId, session: ClientSession) {
    return Payment.findOne({ _id: id }).session(session).exec();
  }

  claimPaymentTransition(id: Types.ObjectId, status: PaymentStatus, fields: Partial<IPayment>, session: ClientSession) {
    return Payment.findOneAndUpdate(
      { _id: id, status: { $nin: [PaymentStatus.SUCCESSFUL, status] } },
      { $set: { ...fields, status } },
      { returnDocument: "after", session },
    ).exec();
  }

  updateNonFinalProviderStatus(id: Types.ObjectId, status: PaymentStatus.PENDING | PaymentStatus.PROCESSING, fields: Partial<IPayment>, allowFailed = false) {
    return Payment.findOneAndUpdate(
      { _id: id, status: { $in: allowFailed ? [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.FAILED] : [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
      { $set: { ...fields, status }, ...(allowFailed ? { $unset: { failureMessage: 1, processedAt: 1 } } : {}) },
      { returnDocument: "after" },
    ).exec();
  }

  savePayment(payment: IPayment, session?: ClientSession) {
    return payment.save({ session });
  }

  updatePlanAfterPayment(
    id: Types.ObjectId,
    amountMinor: number,
    nextPaymentDate: Date | undefined,
    paymentDate: Date,
    session: ClientSession,
  ) {
    return Plan.updateOne(
      { _id: id },
      {
        $inc: { totalContributedAmount: amountMinor },
        $set: {
          status: PlanStatus.ACTIVE,
          coverageStatus: CoverageStatus.COVERED,
          lastPaymentAt: paymentDate,
          ...(nextPaymentDate ? { nextPaymentDate } : {}),
        },
      },
      { session },
    ).exec();
  }

  async findOtherSuccessfulInitialPayment(
    planId: Types.ObjectId,
    paymentId: Types.ObjectId,
    session: ClientSession,
  ) {
    // This also detects successful initial payments created before initialPaymentId was added to the plan schema.
    return Payment.findOne({
      plan: planId,
      purpose: PaymentPurpose.INITIAL,
      status: PaymentStatus.SUCCESSFUL,
      _id: { $ne: paymentId },
    })
      .session(session)
      .exec();
  }

  claimInitialPlanPayment(
    planId: Types.ObjectId,
    paymentId: Types.ObjectId,
    amountMinor: number,
    nextPaymentDate: Date | undefined,
    paymentDate: Date,
    session: ClientSession,
  ) {
    // The plan row is the single atomic gate that allows only one initial payment to add the first contribution.
    return Plan.updateOne(
      {
        _id: planId,
        initialPaymentId: { $exists: false },
        status: { $in: [PlanStatus.PENDING, PlanStatus.ACTIVE] },
      },
      {
        $inc: { totalContributedAmount: amountMinor },
        $set: {
          initialPaymentId: paymentId,
          status: PlanStatus.ACTIVE,
          coverageStatus: CoverageStatus.COVERED,
          lastPaymentAt: paymentDate,
          ...(nextPaymentDate ? { nextPaymentDate } : {}),
        },
      },
      { session },
    ).exec();
  }

  supersedePendingReplacement(
    replacementPaymentId: Types.ObjectId,
    successfulPaymentId: Types.ObjectId,
    session: ClientSession,
  ) {
    // If the expired attempt wins late, the replacement must no longer look payable in local payment history.
    return Payment.updateOne(
      {
        _id: replacementPaymentId,
        purpose: PaymentPurpose.INITIAL,
        status: { $in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      },
      {
        $set: {
          status: PaymentStatus.FAILED,
          failureMessage: "A previous initial payment succeeded before this replacement was paid",
          processedAt: new Date(),
          "metadata.supersededBySuccessfulPaymentId": successfulPaymentId,
          "metadata.manualReconciliationRequired": true,
          "metadata.reconciliationReason": "late_success_for_replaced_checkout",
        },
      },
      { session },
    ).exec();
  }

  async createPaystackEvent(eventKey: string, event: string, reference: string | undefined, payload: Record<string, unknown>) {
    try {
      return await PaystackEvent.findOneAndUpdate(
        { eventKey },
        { $setOnInsert: { eventKey, event, reference, payload, status: "Pending", attempts: 0 } },
        { upsert: true, returnDocument: "after", rawResult: false },
      ).exec();
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      return PaystackEvent.findOne({ eventKey }).exec();
    }
  }

  claimPaystackEvent(now: Date, leaseUntil: Date, lockToken: string) {
    return PaystackEvent.findOneAndUpdate(
      {
        $or: [
          { status: "Pending", $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
          { status: "Failed", $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },
          { status: "Processing", $or: [{ leaseExpiresAt: { $lte: now } }, { leaseExpiresAt: { $exists: false } }] },
        ],
      },
      { $set: { status: "Processing", lockToken, leaseExpiresAt: leaseUntil }, $inc: { attempts: 1 } },
      { sort: { createdAt: 1 }, returnDocument: "after" },
    ).exec();
  }

  finishPaystackEvent(id: Types.ObjectId, lockToken: string, status: "Processed" | "Ignored" | "Failed" | "Exhausted", errorMessage?: string, nextAttemptAt?: Date) {
    const isTerminal = status === "Processed" || status === "Ignored";
    return PaystackEvent.updateOne(
      { _id: id, status: "Processing", lockToken },
      {
        $set: {
          status,
          errorMessage,
          nextAttemptAt,
        },
        $unset: {
          lockToken: 1,
          leaseExpiresAt: 1,
          expiresAt: 1, // Keep all processed/terminal events permanently for deduplication and audit trail
        },
      },
    ).exec();
  }

  markProviderFailure(reference: string, failureMessage: string | undefined) {
    const update = { $set: { status: PaymentStatus.FAILED, failureMessage, processedAt: new Date() } };
    return Payment.findOne({ providerReference: reference }).select("_id").lean().then((providerPayment) => {
      if (providerPayment) {
        return Payment.updateOne({ _id: providerPayment._id, status: { $ne: PaymentStatus.SUCCESSFUL } }, update).exec();
      }
      return Payment.updateOne({ reference, status: { $ne: PaymentStatus.SUCCESSFUL } }, update).exec();
    });
  }

  upsertFailedInvoicePayment(data: Partial<IPayment>) {
    return Payment.findOneAndUpdate(
      { providerReference: data.providerReference },
      { $setOnInsert: data },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).exec();
  }

  listForOwner(ownerId: string, options: PageOptions, filters: { status?: PaymentStatus; purpose?: PaymentPurpose; planId?: string; from?: Date; to?: Date }) {
    const query: Record<string, unknown> = { owner: ownerId };
    if (filters.status) query.status = filters.status;
    if (filters.purpose) query.purpose = filters.purpose;
    if (filters.planId) query.plan = filters.planId;
    if (filters.from || filters.to) query.createdAt = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) };
    return Promise.all([Payment.find(query).sort({ createdAt: -1 }).skip(options.skip).limit(options.limit).exec(), Payment.countDocuments(query).exec()]);
  }

  findForOwner(id: string, ownerId: string) {
    return Payment.findOne({ _id: id, owner: ownerId }).exec();
  }

  async listAll(options: PageOptions, filters: { status?: PaymentStatus; purpose?: PaymentPurpose; from?: Date; to?: Date; search?: string }) {
    const dateMatch = filters.from || filters.to ? { createdAt: { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) } } : {};
    const match: Record<string, any> = { ...dateMatch };
    if (filters.status) match.status = filters.status;
    if (filters.purpose) match.purpose = filters.purpose;
    const regex = filters.search ? { $regex: escapeRegex(filters.search), $options: "i" } : undefined;
    const pipeline: any[] = [
      { $lookup: { from: "users", localField: "owner", foreignField: "_id", as: "ownerRecord" } },
      { $unwind: { path: "$ownerRecord", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "plans", localField: "plan", foreignField: "_id", as: "planRecord" } },
      { $unwind: { path: "$planRecord", preserveNullAndEmptyArrays: true } },
      { $match: match },
      ...(regex ? [{ $match: { $or: [{ reference: regex }, { "ownerRecord.name": regex }, { "ownerRecord.email": regex }, { "planRecord.coveredPerson.fullName": regex }] } }] : []),
    ];
    const [result] = await Payment.aggregate([...pipeline, { $facet: { items: [{ $sort: { createdAt: -1 } }, { $skip: options.skip }, { $limit: options.limit }, { $project: { owner: { _id: "$ownerRecord._id", name: "$ownerRecord.name", email: "$ownerRecord.email" }, plan: { _id: "$planRecord._id", coveredPerson: "$planRecord.coveredPerson", packageDetails: "$planRecord.packageDetails" }, reference: 1, amount: 1, currency: 1, purpose: 1, status: 1, createdAt: 1 } }], total: [{ $count: "value" }] } }]);
    const summaryRows = await Payment.aggregate([{ $match: { ...dateMatch } }, { $group: { _id: "$status", total: { $sum: "$amount" }, count: { $sum: 1 } } }]);
    const summary: Record<string, { amount: number; count: number }> = {};
    for (const row of summaryRows) summary[row._id] = { amount: row.total, count: row.count };
    return { items: result?.items ?? [], total: result?.total?.[0]?.value ?? 0, summary };
  }
}
