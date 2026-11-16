import mongoose, { Document, Schema } from "mongoose";

export interface IPaymentCheckoutLock extends Document {
  key: string;
  ownerToken: string;
  fencingVersion: number;
  leaseExpiresAt: Date;
}

const PaymentCheckoutLockSchema = new Schema<IPaymentCheckoutLock>(
  {
    // One lock row serializes initial checkout replacement for a plan across all app instances.
    key: { type: String, required: true, unique: true },
    ownerToken: { type: String, required: true },
    // Incremented on every acquisition so an expired owner cannot save work after a newer owner takes over.
    // Acquisition increments this from zero on first insert, then from the prior version on takeover.
    fencingVersion: { type: Number, required: true },
    leaseExpiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

// Keep expired rows so fencingVersion only increases; deleting them with a TTL index could let a stale token recur.
export const PaymentCheckoutLock = mongoose.model<IPaymentCheckoutLock>(
  "PaymentCheckoutLock",
  PaymentCheckoutLockSchema,
);
