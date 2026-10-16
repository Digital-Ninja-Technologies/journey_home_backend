import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { successResponse } from '../../../common/response/success-response';
import { BadRequestError } from '@/common/errors/BadRequestError';

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
      const result = await this.authService.getCustomers();
      successResponse(res, 'Customers retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  };
}
