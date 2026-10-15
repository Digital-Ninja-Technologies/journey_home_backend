import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { NotificationRepository } from "../repositories/notification.repository";

export class NotificationController {
  private repository = new NotificationRepository();
  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notifications = await this.repository.listForOwner(req.user!.userId);
      successResponse(res, "Notifications retrieved successfully", notifications);
    } catch (error) {
      next(error);
    }
  };
}
