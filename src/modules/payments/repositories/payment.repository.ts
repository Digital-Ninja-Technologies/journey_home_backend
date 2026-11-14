import { ClientSession, Types } from "mongoose";
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

export class PaymentRepository {
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
      { new: true, session },
    ).exec();
  }

  updateNonFinalProviderStatus(id: Types.ObjectId, status: PaymentStatus.PENDING | PaymentStatus.PROCESSING, fields: Partial<IPayment>, allowFailed = false) {
    return Payment.findOneAndUpdate(
      { _id: id, status: { $in: allowFailed ? [PaymentStatus.PENDING, PaymentStatus.PROCESSING, PaymentStatus.FAILED] : [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
      { $set: { ...fields, status }, ...(allowFailed ? { $unset: { failureMessage: 1, processedAt: 1 } } : {}) },
      { new: true },
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

  async createPaystackEvent(eventKey: string, event: string, reference: string | undefined, payload: Record<string, unknown>) {
    try {
      return await PaystackEvent.findOneAndUpdate(
        { eventKey },
        { $setOnInsert: { eventKey, event, reference, payload, status: "Pending", attempts: 0 } },
        { upsert: true, new: true, rawResult: false },
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
      { sort: { createdAt: 1 }, new: true },
    ).exec();
  }

  finishPaystackEvent(id: Types.ObjectId, lockToken: string, status: "Processed" | "Ignored" | "Failed" | "Exhausted", errorMessage?: string, nextAttemptAt?: Date) {
    const completed = status === "Processed" || status === "Ignored";
    return PaystackEvent.updateOne(
      { _id: id, status: "Processing", lockToken },
      {
        $set: {
          status,
          errorMessage,
          nextAttemptAt,
          ...(completed ? { expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } : {}),
        },
        $unset: {
          lockToken: 1,
          leaseExpiresAt: 1,
          ...(completed ? {} : { expiresAt: 1 }),
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
      { upsert: true, new: true, setDefaultsOnInsert: true },
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
