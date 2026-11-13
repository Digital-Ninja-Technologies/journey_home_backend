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
import { NotificationService } from "../../notifications/services/notification.service";
import { NotificationEvent } from "../../notifications/models/notification.model";

export class ContactService {
  private repository = new ContactRepository();

  async create(dto: CreateContactSubmissionDto): Promise<IContactSubmission> {
    const submission = await this.repository.create({ ...dto, email: dto.email.toLowerCase() });
    await new NotificationService().notifyAdmins({
      event: NotificationEvent.ADMIN_CONTACT_SUBMITTED,
      dedupeKey: `${submission._id}:admin:submitted`,
      message: `${submission.name} sent a contact message about ${submission.topic}.`,
    });
    return submission;
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
