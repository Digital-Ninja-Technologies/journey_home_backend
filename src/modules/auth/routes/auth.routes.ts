import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../../../common/validations/validate';
import { authRequired, requireAdmin, requireSuperAdmin } from '../../../api/middlewares/auth';
import { createRateLimiter } from '../../../api/middlewares/rateLimit';
import {
  LoginValidator,
  AddAdminValidator,
  ChangePasswordValidator,
  SignupValidator,
  EmailTokenValidator,
  EmailAddressValidator,
  PasswordResetValidator,
} from '../validators/auth.validator';

const router = Router();
const authController = new AuthController();
const loginLimit = createRateLimiter(10, 15 * 60 * 1000, "Too many login attempts. Try again later.");
const signupLimit = createRateLimiter(5, 60 * 60 * 1000, "Too many signup attempts. Try again later.");
const tokenLimit = createRateLimiter(10, 60 * 60 * 1000, "Too many token attempts. Try again later.");
const resetLimit = createRateLimiter(5, 60 * 60 * 1000, "Too many password reset attempts. Try again later.");

router.post(
  '/signup',
  signupLimit,
  validate(SignupValidator),
  authController.signup
);

router.post(
  '/login',
  loginLimit,
  validate(LoginValidator),
  authController.login
);

router.get("/me", authRequired, authController.getProfile);
router.post("/verify-email", tokenLimit, validate(EmailTokenValidator), authController.verifyEmail);
router.post("/resend-verification", tokenLimit, validate(EmailAddressValidator), authController.resendVerification);
router.post("/forgot-password", resetLimit, validate(EmailAddressValidator), authController.requestPasswordReset);
router.post("/reset-password", resetLimit, validate(PasswordResetValidator), authController.resetPassword);

// Add Admin
router.post(
  '/admin',
  authRequired,
  requireSuperAdmin,
  validate(AddAdminValidator),
  authController.addAdmin
);

// Delete Admin
router.delete(
  '/admin/:id',
  authRequired,
  requireSuperAdmin,
  authController.deleteAdmin
);

// Change / Reset Password
router.patch(
  '/change-password',
  authRequired,
  requireSuperAdmin,
  validate(ChangePasswordValidator),
  authController.changePassword
);

// List Admins
router.get(
  '/admins',
  authRequired,
  requireSuperAdmin,
  authController.getAdmins
);

router.get("/customers", authRequired, requireAdmin, authController.getCustomers)

export default router;
