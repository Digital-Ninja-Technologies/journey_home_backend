import mongoose, { Document, Schema, Types } from "mongoose";

export enum BillingScheduleStatus {
  ACTIVE = "Active",
  PAUSED = "Paused",
  OVERDUE = "Overdue",
  CANCELLED = "Cancelled",
  COMPLETED = "Completed",
  PROCESSING = "Processing",
}

export interface IBillingSchedule extends Document {
  plan: Types.ObjectId;
  owner: Types.ObjectId;
  nextDueDate: Date;
  billingFrequency: "monthly";
  status: BillingScheduleStatus;
  gracePeriodStartedAt?: Date;
  gracePeriodDeadline?: Date;
  nextRetryDate?: Date;
  retryCount: number;
  billingCycle: string;
  currentPaymentAttempt?: Types.ObjectId;
  lastSuccessfulPaymentDate?: Date;
  lastAttemptedPaymentDate?: Date;
  leaseOwner?: string;
  leaseExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BillingScheduleSchema = new Schema<IBillingSchedule>(
  {
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true, unique: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    nextDueDate: { type: Date, required: true, index: true },
    billingFrequency: { type: String, enum: ["monthly"], default: "monthly" },
    status: { type: String, enum: Object.values(BillingScheduleStatus), default: BillingScheduleStatus.ACTIVE, index: true },
    gracePeriodStartedAt: { type: Date },
    gracePeriodDeadline: { type: Date },
    nextRetryDate: { type: Date, index: true },
    retryCount: { type: Number, default: 0, min: 0 },
    billingCycle: { type: String, required: true },
    currentPaymentAttempt: { type: Schema.Types.ObjectId, ref: "Payment" },
    lastSuccessfulPaymentDate: { type: Date },
    lastAttemptedPaymentDate: { type: Date },
    leaseOwner: { type: String },
    leaseExpiresAt: { type: Date, index: true },
  },
  { timestamps: true },
);

BillingScheduleSchema.index({ status: 1, nextDueDate: 1, leaseExpiresAt: 1 });
BillingScheduleSchema.index({ plan: 1, billingCycle: 1 }, { unique: true });

export const BillingSchedule = mongoose.model<IBillingSchedule>(
  "BillingSchedule",
  BillingScheduleSchema,
);
