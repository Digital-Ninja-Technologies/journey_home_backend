import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { PackageService } from "../services/package.service";

export class PackageController {
  private service = new PackageService();

  listActive = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Packages retrieved successfully", await this.service.listActive());
    } catch (error) {
      next(error);
    }
  };

  listAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Packages retrieved successfully", await this.service.listAll());
    } catch (error) {
      next(error);
    }
  };

  getPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeInactive = Boolean(req.user?.isSuperAdmin || req.user?.role === "admin");

      successResponse(res, "Package retrieved successfully",
        await this.service.getPackage(String(req.params.id), includeInactive));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.create(req.body, req.user!.userId);
      successResponse(res, "Package created successfully", result, 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.update(String(req.params.id), req.body, req.user!.userId);
      successResponse(res, "Package updated successfully", result);
    } catch (error) {
      next(error);
    }
  };
}
