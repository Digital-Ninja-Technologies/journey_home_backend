import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../../../common/validations/validate';
import { authRequired, requireSuperAdmin } from '../../../api/middlewares/auth';
import {
  LoginValidator,
  AddAdminValidator,
  ChangePasswordValidator,
  SignupValidator,
} from '../validators/auth.validator';

const router = Router();
const authController = new AuthController();

router.post(
  '/signup',
  validate(SignupValidator),
  authController.signup
);

router.post(
  '/login',
  validate(LoginValidator),
  authController.login
);

router.post(
  '/admin/login',
  validate(LoginValidator),
  authController.adminLogin
);

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
router.post(
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

export default router;
