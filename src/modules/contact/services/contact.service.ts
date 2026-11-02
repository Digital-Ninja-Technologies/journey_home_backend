import {
  PageOptions,
  pageResult,
  PaginatedResult,
} from "../../../common/utils/pagination";
import { ContactRepository } from "../repositories/contact.repository";
import { CreateContactSubmissionDto } from "../validators/contact.validator";
import { IContactSubmission } from "../models/contact.model";
import { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";

export class ContactService {
  private repository = new ContactRepository();

  create(dto: CreateContactSubmissionDto): Promise<IContactSubmission> {
    return this.repository.create({ ...dto, email: dto.email.toLowerCase() });
  }

  async listAll(options: PageOptions, search?: string): Promise<PaginatedResult<IContactSubmission>> {
    const [items, total] = await this.repository.listAll(options, search);
    return pageResult(items, total, options);
  }

  async getById(id: string): Promise<IContactSubmission> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestError("Invalid contact submission id");
    const submission = await this.repository.findById(id);
    if (!submission) throw new NotFoundError("Contact submission not found");
    return submission;
  }
}
