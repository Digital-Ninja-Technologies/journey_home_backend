import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";

import { NotificationService } from "../services/notification.service";
import { BadRequestError } from "@/common/errors/BadRequestError";

export class NotificationController {
  private service = new NotificationService();
  listMine = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      if(!userId){throw new BadRequestError("UserId not defined")}
      const notifications = await this.service.listForOwner(userId);
      successResponse(
        res,
        "Notifications retrieved successfully",
        notifications,
      );
    } catch (error) {
      next(error);
    }
  };
}
