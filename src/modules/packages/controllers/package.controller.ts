import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { PackageService } from "../services/package.service";

export class PackageController {
  private service = new PackageService();

  listActive = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Packages retrieved successfully", (await this.service.listActive()).map((pkg) => this.service.publicView(pkg)));
    } catch (error) {
      next(error);
    }
  };

  listAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Packages retrieved successfully", (await this.service.listAll()).map((pkg) => this.service.publicView(pkg)));
    } catch (error) {
      next(error);
    }
  };

  getPackage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeInactive = Boolean(req.user?.isSuperAdmin || req.user?.role === "admin");

      const pkg = await this.service.getPackage(String(req.params.id), includeInactive);
      successResponse(res, "Package retrieved successfully", this.service.publicView(pkg));
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.create(req.body, req.user!.userId);
      successResponse(res, "Package created successfully", this.service.publicView(result), 201);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.update(String(req.params.id), req.body, req.user!.userId);
      successResponse(res, "Package updated successfully", this.service.publicView(result));
    } catch (error) {
      next(error);
    }
  };

  syncPaystackPlan = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Package synchronized with Paystack successfully", this.service.publicView(await this.service.syncPaystackPlan(String(req.params.id)))); }
    catch (error) { next(error); }
  };
}
