import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { UserRole } from "../../auth/models/auth.model";
import { PlanService } from "../services/plan.service";
import { BadRequestError } from "@/common/errors/BadRequestError";
import { parsePageOptions, queryString } from "../../../common/utils/pagination";
import { PlanStatus } from "../models/plan.model";

export class PlanController {
  private service = new PlanService();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new BadRequestError("UserID is undefined");
      }

      const result = await this.service.create(userId, req.body);

      successResponse(res, "Plan created successfully", result, 201);
    } catch (error) {
      next(error);
    }
  };

  listForOwner = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        throw new BadRequestError("UserID is undefined");
      }

      const result = await this.service.listForOwner(userId);

      successResponse(res, "Plans retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = queryString(req.query.status);
      if (status && !Object.values(PlanStatus).includes(status as PlanStatus)) throw new BadRequestError("Invalid plan status filter");
      const result = await this.service.listAll(parsePageOptions(req.query), { status: status as PlanStatus | undefined, ownerId: queryString(req.query.ownerId), packageId: queryString(req.query.packageId), search: queryString(req.query.search) });
      successResponse(
        res,
        "Plans retrieved successfully",
        result,
      );
    } catch (error) {
      next(error);
    }
  };

  getPLan = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const planId = req.params.id as string;

      const result = await this.service.getPlan(planId);

      successResponse(res, "Plan retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  adminTransition = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      successResponse(
        res,
        "Plan status updated successfully",
        await this.service.adminTransition(
          String(req.params.id),
          req.body.status,
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}
