import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPackageSnapshot {
  packageId: Types.ObjectId;
  name: string;
  description: string;
  features: string[];
  amount: number;
  currency: string;
  billingInterval: string;
}

export interface IJourneyPackage extends Document {
  name: string;
  description: string;
  features: string[];
  amount: number;
  currency: string;
  billingInterval: "monthly";
  paystackPlanCode?: string;
  paystackPlanId?: number;
  paystackPlanAmount?: number;
  paystackPlanCurrency?: string;
  paystackPlanInterval?: string;
  paystackPlanSyncedAt?: Date;
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

    features: [{ type: String, trim: true }],
    amount: { type: Number, required: true, min: 1 },

    currency: { type: String, required: true, uppercase: true, default: "NGN" },

    billingInterval: {
      type: String,
      enum: ["monthly"],
      default: "monthly",
      required: true,
    },
    paystackPlanCode: { type: String, index: true },

    paystackPlanId: { type: Number },

    paystackPlanAmount: { type: Number },

    paystackPlanCurrency: { type: String },

    paystackPlanInterval: { type: String },

    paystackPlanSyncedAt: { type: Date },

    isActive: { type: Boolean, required: true, default: true, index: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },

    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

JourneyPackageSchema.index({ isActive: 1, createdAt: -1 });

export const Package = mongoose.model<IJourneyPackage>(
  "Package",
  JourneyPackageSchema,
);
