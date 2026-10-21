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

  listForOwner(ownerId: string) {
    return Payment.find({ owner: ownerId }).sort({ createdAt: -1 }).exec();
  }

  findForOwner(id: string, ownerId: string) {
    return Payment.findOne({ _id: id, owner: ownerId }).exec();
  }
}
