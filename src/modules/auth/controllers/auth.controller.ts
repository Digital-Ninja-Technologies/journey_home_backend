import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { successResponse } from '../../../common/response/success-response';
import { BadRequestError } from '@/common/errors/BadRequestError';
import { parsePageOptions, queryString } from "../../../common/utils/pagination";

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const result = await this.authService.login({ email, password });
      successResponse(res, 'Login successful', result, 200);
    } catch (error) {
      next(error);
    }
  };

  signup = async (req: Request, res: Response, next: NextFunction)=> {
    try {
      const result = await this.authService.signup(req.body);
      successResponse(res, 'Signup successful', result, 201);
    } catch (error) {
      next(error);
    }
  };

  addAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.addAdmin(req.body);
      successResponse(res, 'Admin added successfully', result, 201);
    } catch (error) {
      next(error);
    }
  };

  deleteAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = String(req.params.id);
      const requesterId = req.user!.userId;
      const result = await this.authService.deleteAdmin(id, requesterId);
      successResponse(res, 'Admin deleted successfully', result, 200);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new BadRequestError('UserId is undefined')
      }
      const result = await this.authService.changePassword(userId, req.body);
      successResponse(res, 'Password changed successfully', result, 200);
    } catch (error) {
      next(error);
    }
  };

  getAdmins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.getAdmins();
      successResponse(res, 'Admins retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  };

  getCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const verified = queryString(req.query.emailVerified);
      if (verified && verified !== "true" && verified !== "false") throw new BadRequestError("emailVerified must be true or false");
      const emailVerified = verified === "true" ? true : verified === "false" ? false : undefined;
      const result = await this.authService.getCustomers(parsePageOptions(req.query), { search: queryString(req.query.search), emailVerified });
      successResponse(res, 'Customers retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "User profile retrieved successfully", await this.authService.getProfile(req.user!.userId)); }
    catch (error) { next(error); }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Email verified successfully", await this.authService.verifyEmail(req.body.token)); }
    catch (error) { next(error); }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Verification email request processed", await this.authService.resendVerification(req.body.email)); }
    catch (error) { next(error); }
  };

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Password reset request processed", await this.authService.requestPasswordReset(req.body.email)); }
    catch (error) { next(error); }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Password reset successfully", await this.authService.resetPassword(req.body.token, req.body.newPassword)); }
    catch (error) { next(error); }
  };

  updateNotificationPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Notification preferences updated successfully", await this.authService.updateNotificationPreferences(req.user!.userId, req.body)); }
    catch (error) { next(error); }
  };

  closeAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Account deleted successfully", await this.authService.closeAccount(req.user!.userId, req.body.password)); }
    catch (error) { next(error); }
  };
}
