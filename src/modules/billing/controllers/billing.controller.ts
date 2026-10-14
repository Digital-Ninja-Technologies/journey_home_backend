import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { BillingPolicyService } from "../services/billing-policy.service";
import { BillingScheduleService } from "../services/billing-schedule.service";

export class BillingController {
  policy = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Billing policy retrieved successfully", new BillingPolicyService().getPolicy());
    } catch (error) {
      next(error);
    }
  };

  runDue = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Billing run completed", await new BillingScheduleService().processDue());
    } catch (error) {
      next(error);
    }
  };
}
