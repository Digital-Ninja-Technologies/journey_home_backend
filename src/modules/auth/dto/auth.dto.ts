import { Types } from "mongoose";
import { UserRole } from "../models/auth.model";

export interface LoginDto {
  email: string;
  password: string;
}

export interface AddAdminDto {
  email: string;
  password: string;
  name?: string;
}

export interface SignupDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface SignupResponseDto { message: string; email: string; }

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  message: string
}

export interface AdminResponseDto {
  id: Types.ObjectId | string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  createdAt?: Date;
}

export interface AuthResponseDto {
  user: {
    id: Types.ObjectId;
    email: string;
    name: string;
    role: string;
    isSuperAdmin?: boolean;
  };
  token: string;
}

export interface JwtPayload {
  userId: Types.ObjectId | string;
  email: string;
  role: string;
  isSuperAdmin?: boolean;
}
