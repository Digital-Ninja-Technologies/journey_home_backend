import mongoose, { Document, Schema, Types } from "mongoose";

export enum PaymentProvider {
  PAYSTACK = "paystack",
}

export enum PaymentPurpose {
  INITIAL = "initial_contribution",
  RECURRING = "recurring_contribution",
}

export enum PaymentStatus {
  PENDING = "Pending",
  PROCESSING = "Processing",
  SUCCESSFUL = "Successful",
  FAILED = "Failed",
  REFUNDED = "Refunded",
  CANCELLED = "Cancelled",
}

export interface IPayment extends Document {
  owner: Types.ObjectId;
  plan: Types.ObjectId;
  amountMinor: number;
  currency: string;
  reference: string;
  providerReference?: string;
  provider: PaymentProvider;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  billingCycle?: string;
  authorization?: Types.ObjectId;
  failureCode?: string;
  failureMessage?: string;
  providerTransactionId?: string;
  processedAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true },
    reference: { type: String, required: true, unique: true, index: true },
    providerReference: { type: String, index: true },
    provider: { type: String, enum: Object.values(PaymentProvider), default: PaymentProvider.PAYSTACK },
    purpose: { type: String, enum: Object.values(PaymentPurpose), required: true },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING, index: true },
    billingCycle: { type: String },
    authorization: { type: Schema.Types.ObjectId, ref: "PaymentAuthorization" },
    failureCode: { type: String },
    failureMessage: { type: String },
    providerTransactionId: { type: String },
    processedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

PaymentSchema.index({ plan: 1, purpose: 1, billingCycle: 1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
