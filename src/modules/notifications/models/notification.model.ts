import mongoose, { Document, Schema, Types } from "mongoose";

export enum NotificationEvent {
  INITIAL_PAYMENT_SUCCESS = "InitialPaymentSuccess",
  INITIAL_PAYMENT_FAILURE = "InitialPaymentFailure",
  RECURRING_PAYMENT_SUCCESS = "RecurringPaymentSuccess",
  RECURRING_PAYMENT_FAILURE = "RecurringPaymentFailure",
  UPCOMING_CONTRIBUTION = "UpcomingContribution",
  GRACE_PERIOD_STARTED = "GracePeriodStarted",
  PAYMENT_OVERDUE = "PaymentOverdue",
  PAYMENT_RECOVERY_SUCCESS = "PaymentRecoverySuccess",
  SERVICE_REQUEST_RECEIVED = "ServiceRequestReceived",
  SERVICE_DOCUMENTS_APPROVED = "ServiceDocumentsApproved",
  SERVICE_DOCUMENTS_REJECTED = "ServiceDocumentsRejected",
  SERVICE_REQUEST_APPROVED = "ServiceRequestApproved",
  SERVICE_REQUEST_REJECTED = "ServiceRequestRejected",
  SERVICE_MORE_INFO_REQUIRED = "ServiceMoreInfoRequired",
  SERVICE_PROVIDER_ASSIGNED = "ServiceProviderAssigned",
  SERVICE_SCHEDULED = "ServiceScheduled",
  SERVICE_COMPLETED = "ServiceCompleted",
}

export enum NotificationStatus {
  PENDING = "Pending",
  PROCESSING = "Processing",
  SENT = "Sent",
  FAILED = "Failed",
}

export interface INotification extends Document {
  owner: Types.ObjectId;
  plan?: Types.ObjectId;
  event: NotificationEvent;
  dedupeKey: string;
  status: NotificationStatus;
  channel: "email";
  subject?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: Schema.Types.ObjectId, ref: "Plan" },
    event: { type: String, enum: Object.values(NotificationEvent), required: true },
    dedupeKey: { type: String, required: true, unique: true },
    status: { type: String, enum: Object.values(NotificationStatus), default: NotificationStatus.PENDING },
    channel: { type: String, enum: ["email"], default: "email" },
    subject: { type: String },
  },
  { timestamps: true },
);

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
