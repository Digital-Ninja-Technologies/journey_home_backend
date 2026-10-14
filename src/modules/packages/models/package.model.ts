import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPackageSnapshot {
  packageId: Types.ObjectId;
  name: string;
  description: string;
  photographyIncluded: boolean;
  videographyIncluded: boolean;
  coverageDetails?: string;
  deliverables: string[];
  monthlyContributionMinor: number;
  currency: string;
}

export interface IJourneyPackage extends Document {
  name: string;
  description: string;
  photographyIncluded: boolean;
  videographyIncluded: boolean;
  coverageDetails?: string;
  deliverables: string[];
  monthlyContributionMinor: number;
  currency: string;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JourneyPackageSchema = new Schema<IJourneyPackage>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, required: true, trim: true },
    photographyIncluded: { type: Boolean, required: true, default: false },
    videographyIncluded: { type: Boolean, required: true, default: false },
    coverageDetails: { type: String, trim: true },
    deliverables: [{ type: String, trim: true }],
    monthlyContributionMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true, default: "NGN" },
    isActive: { type: Boolean, required: true, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

JourneyPackageSchema.index({ isActive: 1, createdAt: -1 });

export const JourneyPackage = mongoose.model<IJourneyPackage>(
  "JourneyPackage",
  JourneyPackageSchema,
);
