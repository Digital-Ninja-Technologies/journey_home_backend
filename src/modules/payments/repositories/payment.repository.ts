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

  findByProviderReference(reference: string) {
    return Payment.findOne({
      $or: [{ reference }, { providerReference: reference }],
    }).exec();
  }

  findById(id: Types.ObjectId | string) {
    return Payment.findById(id).exec();
  }

  findCurrentPayment(id: Types.ObjectId, session: ClientSession) {
    return Payment.findOne({ _id: id }).session(session).exec();
  }

  savePayment(payment: IPayment, session?: ClientSession) {
    return payment.save({ session });
  }

  updatePlanAfterPayment(
    id: Types.ObjectId,
    amountMinor: number,
    nextPaymentDate: Date | undefined,
    session: ClientSession,
  ) {
    return Plan.updateOne(
      { _id: id },
      {
        $inc: { totalContributedAmount: amountMinor },
        $set: {
          status: PlanStatus.ACTIVE,
          coverageStatus: CoverageStatus.COVERED,
          lastPaymentAt: new Date(),
          ...(nextPaymentDate ? { nextPaymentDate } : {}),
        },
      },
      { session },
    ).exec();
  }

  createPaystackEvent(eventKey: string, event: string, reference?: string) {
    return PaystackEvent.findOneAndUpdate(
      { eventKey },
      { $setOnInsert: { eventKey, event, reference, status: "Processing" } },
      { upsert: true, new: true, rawResult: false },
    ).exec();
  }

  savePaystackEvent(event: InstanceType<typeof PaystackEvent>) {
    return event.save();
  }

  markProviderFailure(reference: string, failureMessage: string | undefined) {
    return Payment.updateOne(
      {
        $or: [{ reference }, { providerReference: reference }],
        status: { $ne: PaymentStatus.SUCCESSFUL },
      },
      {
        $set: {
          status: PaymentStatus.FAILED,
          failureMessage,
          processedAt: new Date(),
        },
      },
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
