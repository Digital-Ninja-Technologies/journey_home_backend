import mongoose, { Document, Schema, Types } from "mongoose";
import { NotificationEvent } from "../../notifications/models/notification.model";

export interface IPaymentNotificationOutbox extends Document {
  dedupeKey: string;
  userId: Types.ObjectId;
  event: NotificationEvent;
  title: string;
  message: string;
  emailStatus: "Pending" | "Sent" | "Skipped" | "Failed";
  inAppStatus: "Pending" | "Sent";
  status: "Pending" | "Processing" | "Sent" | "Failed" | "Exhausted";
  attempts: number;
  nextAttemptAt?: Date;
  lockToken?: string;
  leaseExpiresAt?: Date;
  expiresAt?: Date;
}

const schema = new Schema<IPaymentNotificationOutbox>(
  {
    dedupeKey: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    event: {
      type: String,
      enum: Object.values(NotificationEvent),
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    emailStatus: {
      type: String,
      enum: ["Pending", "Sent", "Skipped", "Failed"],
      default: "Pending",
    },
    inAppStatus: {
      type: String,
      enum: ["Pending", "Sent"],
      default: "Pending",
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Sent", "Failed", "Exhausted"],
      default: "Pending",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, index: true },
    lockToken: { type: String },
    leaseExpiresAt: { type: Date, index: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PaymentNotificationOutbox =
  mongoose.model<IPaymentNotificationOutbox>(
    "PaymentNotificationOutbox",
    schema,
  );
