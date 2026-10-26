import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { UserRole } from "../../auth/models/auth.model";
import { ServiceRequestService } from "../services/service-request.service";
import { parsePageOptions, queryString } from "../../../common/utils/pagination";
import { ServiceRequestStatus } from "../models/service-request.model";
import { BadRequestError } from "../../../common/errors/BadRequestError";

export class ServiceRequestController {
  private service = new ServiceRequestService();

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.create(req.user!.userId, req.body);
      successResponse(res, "Service request submitted successfully", result, 201);
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Service requests retrieved successfully", await this.service.listMine(req.user!.userId));
    } catch (error) {
      next(error);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = queryString(req.query.status);
      if (status && !Object.values(ServiceRequestStatus).includes(status as ServiceRequestStatus)) throw new BadRequestError("Invalid service request status filter");
      const fromRaw = queryString(req.query.from); const toRaw = queryString(req.query.to);
      const from = fromRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? `${fromRaw}T00:00:00.000Z` : fromRaw) : undefined; const to = toRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? `${toRaw}T23:59:59.999Z` : toRaw) : undefined;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw new BadRequestError("Invalid service request date range");
      successResponse(res, "Service requests retrieved successfully", await this.service.listAll(parsePageOptions(req.query), { status: status as ServiceRequestStatus | undefined, ownerId: queryString(req.query.ownerId), planId: queryString(req.query.planId), from, to, search: queryString(req.query.search) }));
    } catch (error) {
      next(error);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
      successResponse(
        res,
        "Service request retrieved successfully",
        await this.service.getForUser(String(req.params.id), req.user!.userId, isAdmin),
      );
    } catch (error) {
      next(error);
    }
  };

  requestDocumentUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.requestDocumentUpload(String(req.params.id), req.user!.userId, req.body);
      successResponse(res, "Service document upload URL generated successfully", result, 201);
    } catch (error) {
      next(error);
    }
  };

  completeDocumentUpload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.completeDocumentUpload(String(req.params.id), req.user!.userId, req.body);
      successResponse(res, "Service document upload completed successfully", result, 201);
    } catch (error) {
      next(error);
    }
  };

  getDocumentDownload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isAdmin = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.SUPER_ADMIN;
      const result = await this.service.getDocumentDownload(
        String(req.params.id),
        String(req.params.documentId),
        req.user!.userId,
        isAdmin,
      );
      successResponse(res, "Service document download URL generated successfully", result);
    } catch (error) {
      next(error);
    }
  };

  verifyDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(
        res,
        "Service document verification updated",
        await this.service.verifyDocument(String(req.params.id), String(req.params.documentId), req.user!.userId, req.body),
      );
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Service request status updated", await this.service.updateStatus(String(req.params.id), req.user!.userId, req.body)); }
    catch (error) { next(error); }
  };

  assignPhotographer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { successResponse(res, "Photographer assigned and service request closed", await this.service.assignPhotographer(String(req.params.id), req.user!.userId, req.body)); }
    catch (error) { next(error); }
  };
}
