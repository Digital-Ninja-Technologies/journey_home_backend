import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPaymentAuthorization extends Document {
  owner: Types.ObjectId;
  plan: Types.ObjectId;
  provider: "paystack";
  authorizationCode: string;
  customerCode?: string;
  customerEmail: string;
  reusable: boolean;
  channel?: string;
  cardType?: string;
  bank?: string;
  last4?: string;
  expMonth?: string;
  expYear?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAuthorizationSchema = new Schema<IPaymentAuthorization>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    provider: { type: String, enum: ["paystack"], default: "paystack" },
    authorizationCode: { type: String, required: true },
    customerCode: { type: String },
    customerEmail: { type: String, required: true, lowercase: true },
    reusable: { type: Boolean, required: true, default: false },
    channel: { type: String },
    cardType: { type: String },
    bank: { type: String },
    last4: { type: String },
    expMonth: { type: String },
    expYear: { type: String },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

PaymentAuthorizationSchema.index({ plan: 1, provider: 1, active: 1 });
PaymentAuthorizationSchema.index({ authorizationCode: 1, plan: 1 }, { unique: true });

export const PaymentAuthorization = mongoose.model<IPaymentAuthorization>(
  "PaymentAuthorization",
  PaymentAuthorizationSchema,
);
