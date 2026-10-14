import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { UserRole } from "../../auth/models/auth.model";
import { PlanService } from "../services/plan.service";

export class PlanController {
  private service = new PlanService();

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.create(req.user!.userId, req.body);
      successResponse(res, "Plan created successfully", result, 201);
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Plans retrieved successfully", await this.service.listForOwner(req.user!.userId));
    } catch (error) {
      next(error);
    }
  };

  listAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Plans retrieved successfully", await this.service.listAll());
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
      const result = isAdmin
        ? await this.service.getForAdmin(String(req.params.id))
        : await this.service.getForOwner(String(req.params.id), req.user!.userId);
      successResponse(res, "Plan retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  adminTransition = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Plan status updated successfully", await this.service.adminTransition(String(req.params.id), req.body.status));
    } catch (error) {
      next(error);
    }
  };
}
