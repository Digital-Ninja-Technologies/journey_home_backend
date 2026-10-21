import mongoose, { Document, Schema, Types } from "mongoose";

export enum SubscriptionStatus {
  PENDING = "Pending",
  ACTIVE = "Active",
  NON_RENEWING = "Non-Renewing",
  ATTENTION = "Attention",
  CANCELLED = "Cancelled",
  COMPLETED = "Completed",
}
export interface ISubscription extends Document {
  owner: Types.ObjectId;
  plan: Types.ObjectId;
  package: Types.ObjectId;
  provider: "paystack";
  providerSubscriptionCode?: string;
  providerCustomerCode?: string;
  providerPlanCode: string;
  status: SubscriptionStatus;
  nextPaymentDate?: Date;
  lastPaymentAt?: Date;
  startedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    plan: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      unique: true,
    },

    package: { type: Schema.Types.ObjectId, ref: "Package", required: true },

    provider: { type: String, enum: ["paystack"], default: "paystack" },

    providerSubscriptionCode: { type: String, sparse: true, unique: true },

    providerCustomerCode: { type: String },

    providerPlanCode: { type: String, required: true, index: true },

    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING,
      index: true,
    },

    nextPaymentDate: Date,
    lastPaymentAt: Date,
    startedAt: Date,
    cancelledAt: Date,
  },

  { timestamps: true },
);
SubscriptionSchema.index({ owner: 1, status: 1 });

SubscriptionSchema.index(
  { owner: 1, providerPlanCode: 1 },
  {
    unique: true,
    partialFilterExpression: { status: SubscriptionStatus.PENDING },
  },
);

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  SubscriptionSchema,
);
