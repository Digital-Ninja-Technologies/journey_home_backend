import mongoose, { Document, Schema } from "mongoose";

export interface IPaystackEvent extends Document {
  eventKey: string;
  event: string;
  reference?: string;
  payload: Record<string, unknown>;
  status: "Pending" | "Processing" | "Processed" | "Ignored" | "Failed" | "Exhausted";
  errorMessage?: string;
  attempts: number;
  nextAttemptAt?: Date;
  lockToken?: string;
  leaseExpiresAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaystackEventSchema = new Schema<IPaystackEvent>(
  {
    eventKey: {
      type: String, required: true,
      unique: true,
    },

    event: { type: String, required: true },

    reference: { type: String, index: true },

    payload: { type: Schema.Types.Mixed, required: true },

    status: { type: String, enum: ["Pending", "Processing", "Processed", "Ignored", "Failed", "Exhausted"], required: true, index: true },
    
    errorMessage: { type: String },
    attempts: { type: Number, default: 0, required: true },
    nextAttemptAt: { type: Date, index: true },
    lockToken: { type: String },
    leaseExpiresAt: { type: Date, index: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

PaystackEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PaystackEvent = mongoose.model<IPaystackEvent>("PaystackEvent", PaystackEventSchema);
