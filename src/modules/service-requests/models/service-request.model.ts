import mongoose, { Document, Schema, Types } from "mongoose";
import { ICoveredPerson } from "../../plans/models/plan.model";

export enum ServiceRequestStatus {
  SUBMITTED = "Submitted",
  UNDER_REVIEW = "Under_Review",
  MORE_INFO_REQUIRED = "More_Info_Required",
  DOCS_VERIFIED = "Docs_Verified",
  APPROVED = "Approved",
  REJECTED = "Rejected",
  CANCELLED = "Cancelled",
  CLOSED = "Closed",
}

export enum ServiceDocumentType {
  DEATH_CERTIFICATE = "Death_Certificate",
  VALID_IDENTIFICATION = "Valid_Identification",
  OTHER_PROOF = "Other_Proof",
}

export enum ServiceDocumentStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REQUIRES_RESUBMISSION = "Requires_Resubmission",
}

export interface IServiceRequest extends Document {
  owner: Types.ObjectId;
  plan: Types.ObjectId;
  coveredPersonSnapshot: ICoveredPerson;
  dateOfDeath: Date;
  serviceLocation: string;
  expectedServiceDate: Date;
  contactPerson: string;
  contactPhone: string;
  additionalInformation?: string;
  status: ServiceRequestStatus;
  rejectionReason?: string;
  moreInfoReason?: string;
  verifiedAt?: Date;
  approvedAt?: Date;
  photographerName?: string;
  photographerAssignedAt?: Date;
  rejectedAt?: Date;
  resubmittedAt?: Date;
  reviewedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IServiceDocument extends Document {
  serviceRequest: Types.ObjectId;
  owner: Types.ObjectId;
  plan: Types.ObjectId;
  file: Types.ObjectId;
  documentType: ServiceDocumentType;
  verificationStatus: ServiceDocumentStatus;
  rejectionReason?: string;
  uploadedAt: Date;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  replacedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CoveredPersonSnapshotSchema = new Schema<ICoveredPerson>(
  {
    fullName: { type: String, required: true },
    dateOfBirth: { type: Date },
    age: { type: Number },
    gender: { type: String },
    relationship: { type: String, required: true },
    address: { type: String, required: true },
    phoneNumber: { type: String },
  },
  { _id: false },
);

const ServiceRequestSchema = new Schema<IServiceRequest>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    coveredPersonSnapshot: {
      type: CoveredPersonSnapshotSchema,
      required: true,
    },
    dateOfDeath: { type: Date, required: true },
    serviceLocation: { type: String, required: true, trim: true },
    expectedServiceDate: { type: Date, required: true },
    contactPerson: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, trim: true },
    additionalInformation: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(ServiceRequestStatus),
      default: ServiceRequestStatus.SUBMITTED,
      required: true,
      index: true,
    },
    rejectionReason: { type: String },
    moreInfoReason: { type: String },
    verifiedAt: { type: Date },
    approvedAt: { type: Date },
    photographerName: { type: String, trim: true },
    photographerAssignedAt: { type: Date },
    rejectedAt: { type: Date },
    resubmittedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

ServiceRequestSchema.index({ owner: 1, createdAt: -1 });
ServiceRequestSchema.index({ plan: 1, status: 1 });

const ServiceDocumentSchema = new Schema<IServiceDocument>(
  {
    serviceRequest: {
      type: Schema.Types.ObjectId,
      ref: "ServiceRequest",
      required: true,
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    plan: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    },
    file: { type: Schema.Types.ObjectId, ref: "File", required: true },
    documentType: {
      type: String,
      enum: Object.values(ServiceDocumentType),
      required: true,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(ServiceDocumentStatus),
      default: ServiceDocumentStatus.PENDING,
      required: true,
      index: true,
    },
    rejectionReason: { type: String },
    uploadedAt: { type: Date, required: true, default: Date.now },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    replacedBy: { type: Schema.Types.ObjectId, ref: "ServiceDocument" },
  },
  { timestamps: true },
);

ServiceDocumentSchema.index({
  serviceRequest: 1,
  documentType: 1,
  createdAt: -1,
});

export const ServiceRequest = mongoose.model<IServiceRequest>(
  "ServiceRequest",
  ServiceRequestSchema,
);
export const ServiceDocument = mongoose.model<IServiceDocument>(
  "ServiceDocument",
  ServiceDocumentSchema,
);
