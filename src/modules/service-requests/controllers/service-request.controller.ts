import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { UserRole } from "../../auth/models/auth.model";
import { ServiceRequestService } from "../services/service-request.service";

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
      successResponse(res, "Service requests retrieved successfully", await this.service.listAll(String(req.query.status || "")));
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

  markUnderReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Service request marked under review", await this.service.markUnderReview(String(req.params.id), req.user!.userId));
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

  markDocsVerified = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Service request documents verified", await this.service.markDocsVerified(String(req.params.id), req.user!.userId));
    } catch (error) {
      next(error);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Service request approved", await this.service.approve(String(req.params.id), req.user!.userId));
    } catch (error) {
      next(error);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Service request rejected", await this.service.reject(String(req.params.id), req.user!.userId, req.body?.reason));
    } catch (error) {
      next(error);
    }
  };

  requestMoreInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "More information requested", await this.service.requestMoreInfo(String(req.params.id), req.user!.userId, req.body.reason));
    } catch (error) {
      next(error);
    }
  };
}
