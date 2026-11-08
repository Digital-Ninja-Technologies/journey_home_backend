import { Request, Response, NextFunction } from "express";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { successResponse } from "../../../common/response/success-response";
import { parsePageOptions, queryString } from "../../../common/utils/pagination";
import { AuditLogService } from "../services/audit-log.service";

export class AuditLogController {
  private service = new AuditLogService();

  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const fromRaw =
        queryString(req.query.from) || queryString(req.query.startDate);
      const toRaw =
        queryString(req.query.to) || queryString(req.query.endDate);

      const from = fromRaw
        ? new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(fromRaw)
              ? `${fromRaw}T00:00:00.000Z`
              : fromRaw,
          )
        : undefined;
      const to = toRaw
        ? new Date(
            /^\d{4}-\d{2}-\d{2}$/.test(toRaw)
              ? `${toRaw}T23:59:59.999Z`
              : toRaw,
          )
        : undefined;

      if (
        (from && Number.isNaN(from.getTime())) ||
        (to && Number.isNaN(to.getTime())) ||
        (from && to && from > to)
      ) {
        throw new BadRequestError("Invalid audit log date range");
      }

      const result = await this.service.getAll(parsePageOptions(req.query), {
        from,
        to,
        action: queryString(req.query.action),
        resourceType: queryString(req.query.resourceType),
        resourceId: queryString(req.query.resourceId),
      });

      successResponse(res, "Audit logs retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  getOne = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const log = await this.service.getOne(String(req.params.id));
      successResponse(res, "Audit log retrieved successfully", log);
    } catch (error) {
      next(error);
    }
  };

  deleteLog = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const log = await this.service.deleteLog(String(req.params.id));
      successResponse(res, "Audit log deleted successfully", log);
    } catch (error) {
      next(error);
    }
  };
}
