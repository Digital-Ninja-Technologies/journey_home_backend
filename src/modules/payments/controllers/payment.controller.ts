import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { PaymentService } from "../services/payment.service";
import { parsePageOptions, queryString } from "../../../common/utils/pagination";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { PaymentPurpose, PaymentStatus } from "../models/payment.model";

export class PaymentController {
  private service = new PaymentService();

  initializeInitial = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.initializeInitialCheckout(String(req.params.planId), req.user!.userId);
      successResponse(res, "Checkout initialized successfully", {
        paymentId: result.payment._id,
        reference: result.reference,
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
      }, 201);
    } catch (error) {
      next(error);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Payment verified successfully", await this.service.verifyAndApply(String(req.params.reference)));
    } catch (error) {
      next(error);
    }
  };

  webhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Webhook processed", await this.service.processWebhook(req.body, req.rawBody, req.headers["x-paystack-signature"]));
    } catch (error) {
      next(error);
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = queryString(req.query.status); const purpose = queryString(req.query.purpose);
      if (status && !Object.values(PaymentStatus).includes(status as PaymentStatus)) throw new BadRequestError("Invalid payment status filter");
      if (purpose && !Object.values(PaymentPurpose).includes(purpose as PaymentPurpose)) throw new BadRequestError("Invalid payment purpose filter");
      const fromRaw = queryString(req.query.from); const toRaw = queryString(req.query.to);
      const from = fromRaw ? new Date(fromRaw) : undefined; const to = toRaw ? new Date(toRaw) : undefined;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw new BadRequestError("Invalid payment date range");
      successResponse(res, "Payments retrieved successfully", await this.service.listForOwner(req.user!.userId, parsePageOptions(req.query), { status: status as PaymentStatus | undefined, purpose: purpose as PaymentPurpose | undefined, planId: queryString(req.query.planId), from, to }));
    } catch (error) {
      next(error);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = queryString(req.query.status), purpose = queryString(req.query.purpose);
      if (status && !Object.values(PaymentStatus).includes(status as PaymentStatus)) throw new BadRequestError("Invalid payment status filter");
      if (purpose && !Object.values(PaymentPurpose).includes(purpose as PaymentPurpose)) throw new BadRequestError("Invalid payment purpose filter");
      const fromRaw = queryString(req.query.from), toRaw = queryString(req.query.to);
      const from = fromRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) ? `${fromRaw}T00:00:00.000Z` : fromRaw) : undefined, to = toRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? `${toRaw}T23:59:59.999Z` : toRaw) : undefined;
      if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw new BadRequestError("Invalid payment date range");
      successResponse(res, "Payments retrieved successfully", await this.service.listAll(parsePageOptions(req.query), { status: status as PaymentStatus | undefined, purpose: purpose as PaymentPurpose | undefined, from, to, search: queryString(req.query.search) }));
    } catch (error) { next(error); }
  };

  getMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Payment retrieved successfully", await this.service.getForOwner(String(req.params.id), req.user!.userId));
    } catch (error) {
      next(error);
    }
  };
}
