import { z } from 'zod';
import { UserRole } from '../models/auth.model';

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

export const SignupValidator = z.object({
  email: z.string().email('Invalid email format').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(2, 'Name is required'),
  role: z.enum([UserRole.CUSTOMER, UserRole.COVERED_PERSON]).default(UserRole.CUSTOMER),
});

export type SignupValidation = z.infer<typeof SignupValidator>;

export const EmailTokenValidator = z.object({ token: z.string().min(32) });
export const EmailAddressValidator = z.object({ email: z.string().email() });
export const PasswordResetValidator = z.object({ token: z.string().min(32), newPassword: z.string().min(8) });
export const NotificationPreferencesValidator = z.object({
  paymentReminders: z.boolean(), deficitAlerts: z.boolean(),
  serviceRequestUpdates: z.boolean(), productNewsOffers: z.boolean(),
});
export const CloseAccountValidator = z.object({ password: z.string().min(1) });

export const ChangePasswordValidator = z.object({
  adminId: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export type ChangePasswordValidation = z.infer<typeof ChangePasswordValidator>;
