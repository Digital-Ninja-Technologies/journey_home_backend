import { z } from 'zod';

export const LoginValidator = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginValidation = z.infer<typeof LoginValidator>;

export const AddAdminValidator = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().optional(),
});

export type AddAdminValidation = z.infer<typeof AddAdminValidator>;

export const ChangePasswordValidator = z.object({
  adminId: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export type ChangePasswordValidation = z.infer<typeof ChangePasswordValidator>;