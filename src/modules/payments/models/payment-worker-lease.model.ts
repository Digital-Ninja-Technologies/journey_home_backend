import mongoose, { Document, Schema } from "mongoose";

export interface IPaymentWorkerLease extends Document {
  name: string;
  ownerToken: string;
  expiresAt: Date;
}

const schema = new Schema<IPaymentWorkerLease>(
  {
    name: { type: String, required: true, unique: true },
    ownerToken: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

export const PaymentWorkerLease = mongoose.model<IPaymentWorkerLease>(
  "PaymentWorkerLease",
  schema,
);
