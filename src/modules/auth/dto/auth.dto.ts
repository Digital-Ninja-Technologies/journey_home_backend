import { Types }  from "mongoose";

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
}

export interface ChangePasswordDto {
  adminId?: string;
  email?: string;
  newPassword: string;
}

export interface AdminResponseDto {
  id: Types.ObjectId | string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin: boolean;
  password?: string;
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
