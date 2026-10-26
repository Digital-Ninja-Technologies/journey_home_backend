import mongoose, { Schema, Document } from "mongoose";

export enum UserRole {
  CUSTOMER = "customer",
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  COVERED_PERSON = "covered_person",
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  isSuperAdmin: boolean;
  name: string;
  isEmailVerified: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  notificationPreferences: { paymentReminders: boolean; deficitAlerts: boolean; serviceRequestUpdates: boolean; productNewsOffers: boolean };
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    passwordHash: { type: String, required: true },

    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      default: UserRole.CUSTOMER,
    },

    isSuperAdmin: {
      type: Boolean,
      default: false,
    },

    name: { type: String, required: true, trim: true },
    isEmailVerified: { type: Boolean, default: true },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiresAt: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
    notificationPreferences: { type: new Schema({ paymentReminders: { type: Boolean, default: true }, deficitAlerts: { type: Boolean, default: true }, serviceRequestUpdates: { type: Boolean, default: true }, productNewsOffers: { type: Boolean, default: false } }, { _id: false }), default: () => ({}) },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", UserSchema);
