import mongoose, { Document, Schema, Types } from "mongoose";

export enum NotificationEvent {
  PLAN_CREATED = "PlanCreated",
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
  PRODUCT_NEWS_OFFERS = "ProductNewsOffers",
}

export enum NotificationChannel {
  IN_APP = "in_app",
  EMAIL = "email",
}

export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  event: NotificationEvent;
  dedupeKey: string;
  channel: NotificationChannel;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    event: { type: String, enum: Object.values(NotificationEvent), required: true },
    dedupeKey: { type: String, required: true, unique: true },
    channel: { type: String, enum: Object.values(NotificationChannel), required: true, default: NotificationChannel.IN_APP },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, title: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);
