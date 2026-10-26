import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../common/response/success-response";
import { parsePageOptions, queryString } from "../../common/utils/pagination";
import { BadRequestError } from "../../common/errors/BadRequestError";
import { AdminDashboardService } from "./admin.service";

export class AdminController {

  private service = new AdminDashboardService();

  overview = async (req: Request, res: Response, next: NextFunction) => {
    try {

      const startRaw = queryString(req.query.startDate),
        
        endRaw = queryString(req.query.endDate);
      
      const startDate = startRaw
        ? new Date(`${startRaw}T00:00:00.000Z`)
        : undefined;
      
      const endDate = endRaw ? new Date(`${endRaw}T23:59:59.999Z`) : undefined;

      if (
        (startDate && Number.isNaN(startDate.getTime())) ||
        (endDate && Number.isNaN(endDate.getTime())) ||
        (startDate && endDate && startDate > endDate)
      )
        throw new BadRequestError("Invalid dashboard date range");
      
      successResponse(
        res,
        "Admin dashboard overview retrieved successfully",
        await this.service.overview(startDate, endDate),
      );
    } catch (error) {
      next(error);
    }
  };
  
  users = async (req: Request, res: Response, next: NextFunction) => {
    try {
      successResponse(
        res,
        "Users retrieved successfully",
        await this.service.users(
          parsePageOptions(req.query),
          queryString(req.query.search),
        ),
      );
    } catch (error) {
      next(error);
    }
  };
}
