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
  state?: string
}

export interface IPlan extends Document {
  owner: Types.ObjectId;
  package: Types.ObjectId;
  packageDetails: IPackageSnapshot;
  coveredPerson: ICoveredPerson;
  amount: number;
  currency: string;
  billingInterval: "monthly";
  startDate: Date;
  nextPaymentDate: Date;
  totalContributedAmount: number;
  status: PlanStatus;
  coverageStatus: CoverageStatus;
  lastPaymentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PackageDetailsSchema = new Schema<IPackageSnapshot>(
  {
    packageId: { type: Schema.Types.ObjectId, ref: "Package", required: true },

    name: { type: String, required: true },

    description: { type: String, required: true },

    features: [{ type: String }],

    amount: {
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

    state: {type: String, trim: true, required: false}
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

    packageDetails: { type: PackageDetailsSchema, required: true },

    coveredPerson: { type: CoveredPersonSchema, required: true },

    amount: { type: Number, required: true, min: 1 },

    currency: { type: String, required: true, uppercase: true },

    billingInterval: { type: String, enum: ["monthly"], default: "monthly" },

    startDate: { type: Date, required: true },

    nextPaymentDate: { type: Date },

    totalContributedAmount: {
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
