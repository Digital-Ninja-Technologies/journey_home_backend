import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { PaymentService } from "../services/payment.service";

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
      successResponse(res, "Payments retrieved successfully", await this.service.listForOwner(req.user!.userId));
    } catch (error) {
      next(error);
    }
  };

  getMine = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      successResponse(res, "Payment retrieved successfully", await this.service.getForOwner(String(req.params.id), req.user!.userId));
    } catch (error) {
      next(error);
    }
  };
}
