import { Request, Response, NextFunction } from "express";
import { successResponse } from "../../../common/response/success-response";
import { parsePageOptions, queryString } from "../../../common/utils/pagination";
import { ContactService } from "../services/contact.service";

export class ContactController {
  private service = new ContactService();

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.create(req.body);
      successResponse(res, "Your message has been sent successfully", result, 201);
    } catch (error) {
      next(error);
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listAll(
        parsePageOptions(req.query),
        queryString(req.query.search),
      );
      successResponse(res, "Contact messages retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getById(String(req.params.id));
      successResponse(res, "Contact message retrieved successfully", result);
    } catch (error) {
      next(error);
    }
  };
}
