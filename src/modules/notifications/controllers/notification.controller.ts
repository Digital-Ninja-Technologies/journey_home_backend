import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { Notification } from "../models/notification.model";

export class NotificationController {
  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notifications = await Notification.find({ owner: req.user!.userId }).sort({ createdAt: -1 }).exec();
      successResponse(res, "Notifications retrieved successfully", notifications);
    } catch (error) {
      next(error);
    }
  };
}
