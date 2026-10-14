import mongoose, { Document, Schema } from "mongoose";

export interface IPaystackEvent extends Document {
  eventKey: string;
  event: string;
  reference?: string;
  status: "Processing" | "Processed" | "Ignored" | "Failed";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaystackEventSchema = new Schema<IPaystackEvent>(
  {
    eventKey: { type: String, required: true, unique: true, index: true },
    event: { type: String, required: true },
    reference: { type: String, index: true },
    status: { type: String, enum: ["Processing", "Processed", "Ignored", "Failed"], required: true },
    errorMessage: { type: String },
  },
  { timestamps: true },
);

export const PaystackEvent = mongoose.model<IPaystackEvent>("PaystackEvent", PaystackEventSchema);
