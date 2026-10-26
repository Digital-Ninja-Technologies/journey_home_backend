import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { successResponse } from "../../../common/response/success-response";
import { parsePageOptions, queryString } from "../../../common/utils/pagination";
import { NotificationService } from "../services/notification.service";

export class NotificationController {
  private service = new NotificationService();

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const readValue = queryString(req.query.isRead);
      if (readValue && readValue !== "true" && readValue !== "false") throw new BadRequestError("isRead must be true or false");
      const fromRaw = queryString(req.query.from);
      const toRaw = queryString(req.query.to);
      const from = fromRaw ? new Date(fromRaw) : undefined;
      const to = toRaw ? new Date(toRaw) : undefined;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) {
        throw new BadRequestError("Invalid notification date range");
      }
      const result = await this.service.listForOwner(userId, parsePageOptions(req.query), {
        title: queryString(req.query.title),
        isRead: readValue === "true" ? true : readValue === "false" ? false : undefined,
        from,
        to,
      });
      successResponse(res, "Notifications retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Notification marked as read", await this.service.markRead(String(req.params.id), req.user!.userId));
    } catch (error) {
      next(error);
    }
  };

  deleteMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Notification deleted successfully", await this.service.delete(String(req.params.id), req.user!.userId));
    } catch (error) {
      next(error);
    }
  };
}
