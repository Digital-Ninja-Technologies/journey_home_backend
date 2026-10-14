import mongoose, { Schema, Document } from "mongoose";

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  isSuperAdmin: boolean;
  name: string;
  createdAt: Date;
  updatedAt: Date;
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
      default: UserRole.ADMIN,
    },

    isSuperAdmin: {
      type: Boolean,
      default: false,
    },

    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

export const User = mongoose.model<IUser>("User", UserSchema);
