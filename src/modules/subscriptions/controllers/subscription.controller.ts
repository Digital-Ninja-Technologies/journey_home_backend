import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { SubscriptionService } from "../services/subscription.service";
export class SubscriptionController {
  private service = new SubscriptionService();
  list = async (req: Request, res: Response, next: NextFunction) => { try { successResponse(res, "Subscriptions retrieved successfully", await this.service.list(req.user!.userId)); } catch (error) { next(error); } };
  get = async (req: Request, res: Response, next: NextFunction) => { try { successResponse(res, "Subscription retrieved successfully", await this.service.get(String(req.params.id), req.user!.userId)); } catch (error) { next(error); } };
}
