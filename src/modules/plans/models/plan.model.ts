import mongoose, { Document, Schema, Types } from "mongoose";
import { IPackageSnapshot } from "../../packages/models/package.model";

export enum PlanStatus {
  PENDING = "Pending",
  ACTIVE = "Active",
  PAYMENT_DUE = "Payment_Due",
  OVERDUE = "Overdue",
  PAUSED = "Paused",
  SERVICE_REQUEST = "Service_Request",
  UNDER_REVIEW = "Under_Review",
  APPROVED = "Approved",
  SERVICE_SCHEDULED = "Service_Scheduled",
  COMPLETED = "Completed",
  CANCELLED = "Cancelled",
  EXPIRED = "Expired",
}

export enum CoverageStatus {
  PENDING = "Pending",
  COVERED = "Covered",
  UNDER_REVIEW = "Under_Review",
  NOT_COVERED = "Not_Covered",
}

export interface ICoveredPerson {
  fullName: string;
  dateOfBirth?: Date;
  age?: number;
  gender?: string;
  relationship: string;
  address: string;
  phoneNumber?: string;
}

export interface IPlan extends Document {
  owner: Types.ObjectId;
  package: Types.ObjectId;
  packageSnapshot: IPackageSnapshot;
  coveredPerson: ICoveredPerson;
  contributionAmountMinor: number;
  currency: string;
  billingFrequency: "monthly";
  startDate: Date;
  nextPaymentDate: Date;
  totalContributedMinor: number;
  status: PlanStatus;
  coverageStatus: CoverageStatus;
  lastPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PackageSnapshotSchema = new Schema<IPackageSnapshot>(
  {
    packageId: { type: Schema.Types.ObjectId, ref: "Package", required: true },

    name: { type: String, required: true },

    description: { type: String, required: true },

    photographyIncluded: { type: Boolean, required: true },

    videographyIncluded: { type: Boolean, required: true },

    coverageDetails: { type: String },

    deliverables: [{ type: String }],

    monthlyContributionMinor: {
      type: Number,
      required: true,
    },

    currency: { type: String, required: true },
  },
  { _id: false },
);

const CoveredPersonSchema = new Schema<ICoveredPerson>(
  {
    fullName: { type: String, required: true, trim: true },

    dateOfBirth: { type: Date },

    age: { type: Number, min: 0 },

    gender: { type: String, trim: true },

    relationship: { type: String, required: true, trim: true },

    address: { type: String, required: true, trim: true },

    phoneNumber: { type: String, trim: true },
  },
  { _id: false },
);

const PlanSchema = new Schema<IPlan>(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    package: { type: Schema.Types.ObjectId, ref: "Package", required: true },

    packageSnapshot: { type: PackageSnapshotSchema, required: true },

    coveredPerson: { type: CoveredPersonSchema, required: true },

    contributionAmountMinor: { type: Number, required: true, min: 1 },

    currency: { type: String, required: true, uppercase: true },

    billingFrequency: { type: String, enum: ["monthly"], default: "monthly" },

    startDate: { type: Date, required: true },

    nextPaymentDate: { type: Date, required: true },

    totalContributedMinor: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: Object.values(PlanStatus),
      default: PlanStatus.PENDING,
      index: true,
    },

    coverageStatus: {
      type: String,
      enum: Object.values(CoverageStatus),
      default: CoverageStatus.PENDING,
    },

    lastPaymentAt: { type: Date },
  },
  { timestamps: true },
);

PlanSchema.index({ owner: 1, createdAt: -1 });

export const Plan = mongoose.model<IPlan>("Plan", PlanSchema);
