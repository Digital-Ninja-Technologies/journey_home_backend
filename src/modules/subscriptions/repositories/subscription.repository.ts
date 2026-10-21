import {
  Subscription,
  ISubscription,
  SubscriptionStatus,
} from "../models/subscription.model";
import { Types } from "mongoose";
export class SubscriptionRepository {
  create(data: Partial<ISubscription>) {
    return Subscription.create(data);
  }

  findByPlan(plan: Types.ObjectId | string) {
    return Subscription.findOne({ plan }).exec();
  }

  findPendingForOwnerPlan(
    owner: Types.ObjectId | string,
    plan: Types.ObjectId | string,
  ) {
    return Subscription.findOne({
      owner,
      plan,
      status: SubscriptionStatus.PENDING,
    }).exec();
  }

  findPendingForOwnerPlanCode(
    owner: Types.ObjectId | string,
    providerPlanCode: string,
  ) {
    return Subscription.find({
      owner,
      providerPlanCode,
      status: SubscriptionStatus.PENDING,
    }).exec();
  }

  findOtherPendingForOwnerPlanCode(
    owner: Types.ObjectId | string,
    providerPlanCode: string,
    plan: Types.ObjectId | string,
  ) {
    return Subscription.findOne({
      owner,
      providerPlanCode,
      plan: { $ne: plan },
      status: SubscriptionStatus.PENDING,
    }).exec();
  }

  findByProviderCode(code: string) {
    return Subscription.findOne({ providerSubscriptionCode: code }).exec();
  }

  attachProvider(data: {
    id: Types.ObjectId;
    code: string;
    customerCode?: string;
    nextPaymentDate?: Date;
    startedAt?: Date;
  }) {
    return Subscription.findOneAndUpdate(
      { _id: data.id },
      {
        $set: {
          providerSubscriptionCode: data.code,
          providerCustomerCode: data.customerCode,
          status: SubscriptionStatus.ACTIVE,
          nextPaymentDate: data.nextPaymentDate,
          startedAt: data.startedAt || new Date(),
        },
      },
      { new: true },
    ).exec();
  }

  setActive(subscription: ISubscription, fields: Partial<ISubscription>) {
    Object.assign(subscription, fields, { status: SubscriptionStatus.ACTIVE });
    return subscription.save();
  }

  listForOwner(owner: string) {
    return Subscription.find({ owner }).sort({ createdAt: -1 }).exec();
  }

  findByIdForOwner(id: string, owner: string) {
    return Subscription.findOne({ _id: id, owner }).exec();
  }

  listReminders(date: Date) {
    return Subscription.find({
      status: SubscriptionStatus.ACTIVE,
      nextPaymentDate: date,
    })
      .populate("owner", "email name")
      .populate("plan", "packageSnapshot")
      .exec();
  }
  
  listRemindersBetween(start: Date, end: Date) {
    return Subscription.find({
      status: SubscriptionStatus.ACTIVE,
      nextPaymentDate: { $gte: start, $lt: end },
    })
      .populate("owner", "email name")
      .populate("plan", "packageSnapshot")
      .exec();
  }
}
