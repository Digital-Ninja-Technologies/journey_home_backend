 import mongoose, { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { ForbiddenError } from "../../../common/errors/ForbiddenError";
import { FilePurpose, FileStatus } from "../../file/models/file.model";
import { FileService } from "../../file/services/file.service";
import { FileRepository } from "../../file/repositories/file.repository";
import { PlanStatus } from "../../plans/models/plan.model";
import { AuditLogService } from "../../audit/services/audit-log.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { NotificationEvent } from "../../notifications/models/notification.model";
import {
  ServiceDocumentStatus,
  ServiceRequestStatus,
  IServiceRequest,
  IServiceDocument,
} from "../models/service-request.model";
import { ServiceRequestRepository } from "../repositories/service-request.repository";
import { AdminRequestStatusDto } from "../validators/service-request.validator";
import { CreateServiceRequestDto, RequestServiceDocumentUploadDto, CompleteServiceDocumentUploadDto, VerifyServiceDocumentDto } from "../validators/service-request.validator";
import { PageOptions, pageResult, PaginatedResult } from "../../../common/utils/pagination";

export class ServiceRequestService {
  private files = new FileService();
  private fileRepo = new FileRepository();
  private audit = new AuditLogService();
  private notifications = new NotificationService();
  private repository = new ServiceRequestRepository();

  async create(ownerId: string, dto: CreateServiceRequestDto): Promise<IServiceRequest> {
    const plan = await this.repository.findPlanForOwner(dto.planId, ownerId);

    if (!plan) throw new NotFoundError("Plan not found");

    if (
      ![PlanStatus.ACTIVE, PlanStatus.PAYMENT_DUE, PlanStatus.OVERDUE].includes(
        plan.status,
      )
    ) {
      throw new BadRequestError(
        "Service requests can only be opened for active or payment-due plans",
      );
    }

    const newOwnerId = new Types.ObjectId(ownerId);

    const request = await this.repository.create({
      owner: newOwnerId,
      plan: plan._id,
      coveredPersonSnapshot: plan.coveredPerson,
      dateOfDeath: new Date(dto.dateOfDeath),
      burialLocation: dto.burialLocation,
      expectedBurialDate: new Date(dto.expectedBurialDate),
      contactPerson: dto.contactPerson,
      contactPhone: dto.contactPhone,
      additionalInformation: dto.additionalInformation,
      status: ServiceRequestStatus.SUBMITTED,
    });

    await this.repository.setPlanStatus(plan._id, PlanStatus.SERVICE_REQUEST);

    await this.audit.record({
      actorId: ownerId,
      action: "service_request.created",
      resourceType: "ServiceRequest",
      resourceId: request._id.toString(),
      metadata: { planId: plan._id.toString() },
    });

    await this.notifications.record(
      ownerId,
      plan._id.toString(),
      NotificationEvent.SERVICE_REQUEST_RECEIVED,
      `${request._id}:received`,
    );

    return request;
  }

  async listMine(ownerId: string): Promise<IServiceRequest[]> {
    return this.repository.listMine(ownerId);
  }

  async listAll(options: PageOptions, filters: { status?: ServiceRequestStatus; ownerId?: string; planId?: string; from?: Date; to?: Date }): Promise<PaginatedResult<IServiceRequest>> {
    const [items, total] = await this.repository.listAll(options, filters);
    return pageResult(items, total, options);
  }

  async getForUser(
    requestId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<{ request: IServiceRequest; documents: IServiceDocument[] }> {
    if (!Types.ObjectId.isValid(requestId))
      throw new BadRequestError("Invalid service request id");

    const query = isAdmin
      ? { _id: requestId }
      : { _id: requestId, owner: userId };

    const request = await this.repository.findRequest(query);

    if (!request) throw new NotFoundError("Service request not found");

    const documents = await this.repository.listDocuments(request._id);

    if (isAdmin) {
      await this.audit.record({
        actorId: userId,
        action: "service_request.viewed_by_admin",
        resourceType: "ServiceRequest",
        resourceId: request._id.toString(),
      });
    }

    return { request, documents };
  }

  async requestDocumentUpload(requestId: string, ownerId: string, dto: RequestServiceDocumentUploadDto) {
    const request = await this.repository.findRequest({
      _id: requestId,
      owner: ownerId,
    });

    if (!request) throw new NotFoundError("Service request not found");

    if (
      [
        ServiceRequestStatus.APPROVED,
        ServiceRequestStatus.REJECTED,
        ServiceRequestStatus.CANCELLED,
      ].includes(request.status)
    ) {
      throw new BadRequestError(
        "Documents cannot be uploaded for this service request status",
      );
    }

    return this.files.requestUploadUrl({
      fileName: dto.fileName,
      contentType: dto.contentType,
      size: dto.size,
      purpose: FilePurpose.SERVICE_DOCUMENT,
      ownerId,
      entityId: request._id.toString(),
    });
  }

  async completeDocumentUpload(
    requestId: string,
    ownerId: string,
    dto: CompleteServiceDocumentUploadDto,
  ): Promise<IServiceDocument> {
    const request = await this.repository.findRequest({
      _id: requestId,
      owner: ownerId,
    });

    if (!request) throw new NotFoundError("Service request not found");

    if (
      [
        ServiceRequestStatus.APPROVED,
        ServiceRequestStatus.REJECTED,
        ServiceRequestStatus.CANCELLED,
      ].includes(request.status)
    ) {
      throw new BadRequestError(
        "Documents cannot be uploaded for this service request status",
      );
    }

    const file = await this.fileRepo.findById(dto.fileId);

    if (
      !file ||
      file.owner?.toString() !== ownerId ||
      file.entityId !== request._id.toString()
    ) {
      throw new ForbiddenError("File does not belong to this service request");
    }

    const completed = await this.files.completeUpload(
      dto.fileId,
      dto.uploadToken,
      request._id.toString(),
    );

    if (completed.file.status !== FileStatus.UPLOADED)
      throw new BadRequestError("File upload was not completed");

    let replacedDocument: IServiceDocument | null = null;

    if (dto.replacesDocumentId) {
      replacedDocument = await this.repository.findDocument({
        _id: dto.replacesDocumentId,
        serviceRequest: request._id,
        owner: ownerId,
      });

      if (!replacedDocument)
        throw new NotFoundError("Document to replace not found");
    }

    const newOwnerId = new Types.ObjectId(ownerId);
    const session = await mongoose.startSession();

    try {
      let document!: IServiceDocument;

      // Save the new document and update the request in one transaction.
      await session.withTransaction(async () => {
        document = await this.repository.createDocument(
          {
            serviceRequest: request._id,
            owner: newOwnerId,
            plan: request.plan,
            file: completed.file._id,
            documentType: dto.documentType,
            verificationStatus: ServiceDocumentStatus.PENDING,
          },
          session,
        );

        if (replacedDocument) {
          await this.repository.markDocumentReplaced(
            replacedDocument._id,
            document._id,
            session,
          );
        }

        await this.repository.resetForResubmission(request._id, session);
      });

      await this.audit.record({
        actorId: ownerId,
        action: replacedDocument
          ? "service_document.resubmitted"
          : "service_document.uploaded",
        resourceType: "ServiceDocument",
        resourceId: document._id.toString(),
        metadata: {
          serviceRequestId: request._id.toString(),
          documentType: dto.documentType,
        },
      });

      return document;
    } finally {
      await session.endSession();
    }
  }

  // Returns a temporary download link after checking access.
  async getDocumentDownload(
    requestId: string,
    documentId: string,
    userId: string,
    isAdmin: boolean,
  ) {
    const query = isAdmin
      ? { _id: requestId }
      : { _id: requestId, owner: userId };

    const request = await this.repository.findRequest(query);

    if (!request) throw new NotFoundError("Service request not found");

    const document = await this.repository.findDocument({
      _id: documentId,
      serviceRequest: request._id,
    });

    if (!document) throw new NotFoundError("Document not found");

    const result = await this.files.getFileById(document.file.toString());

    await this.audit.record({
      actorId: userId,
      action: isAdmin
        ? "service_document.viewed_by_admin"
        : "service_document.viewed_by_owner",
      resourceType: "ServiceDocument",
      resourceId: document._id.toString(),
    });

    return { document, url: result.url, expiresIn: 900 };
  }

  // Updates document verification and requests resubmission when needed.
  async  verifyDocument(
    requestId: string,
    documentId: string,
    adminId: string,
    dto: VerifyServiceDocumentDto,
  ): Promise<IServiceDocument> {
    const request = await this.repository.findRequestById(requestId);

    if (!request) throw new NotFoundError("Service request not found");

    const document = await this.repository.findDocument({
      _id: documentId,
      serviceRequest: request._id,
    });

    if (!document) throw new NotFoundError("Document not found");

    document.verificationStatus = dto.verificationStatus;
    document.rejectionReason = dto.reason;
    document.verifiedAt = new Date();
    document.verifiedBy = new Types.ObjectId(adminId);

    await this.repository.saveDocument(document);

    if (
      dto.verificationStatus === ServiceDocumentStatus.REQUIRES_RESUBMISSION
    ) {
      request.status = ServiceRequestStatus.MORE_INFO_REQUIRED;
      request.moreInfoReason = dto.reason;

      await this.repository.saveRequest(request);

      await this.notifications.record(
        request.owner.toString(),
        request.plan.toString(),
        NotificationEvent.SERVICE_DOCUMENTS_REJECTED,
        `${document._id}:requires_resubmission`,
      );
    }

    await this.audit.record({
      actorId: adminId,
      action:
        dto.verificationStatus === ServiceDocumentStatus.APPROVED
          ? "service_document.approved"
          : "service_document.requires_resubmission",
      resourceType: "ServiceDocument",
      resourceId: document._id.toString(),
      metadata: {
        serviceRequestId: request._id.toString(),
        reason: dto.reason,
      },
    });

    return document;
  }

  async updateStatus(requestId: string, adminId: string, dto: AdminRequestStatusDto): Promise<IServiceRequest> {
    if (!Types.ObjectId.isValid(requestId)) throw new BadRequestError("Invalid service request id");
    const request = await this.repository.findRequestById(requestId);
    if (!request) throw new NotFoundError("Service request not found");

    if (dto.status === ServiceRequestStatus.APPROVED && ![ServiceRequestStatus.DOCS_VERIFIED, ServiceRequestStatus.UNDER_REVIEW].includes(request.status)) {
      throw new BadRequestError("Documents must be verified or the request under review before approval");
    }
    if (dto.status === ServiceRequestStatus.DOCS_VERIFIED) {
      const documents = await this.repository.listCurrentDocuments(request._id);
      if (!documents.length || documents.some((doc) => doc.verificationStatus !== ServiceDocumentStatus.APPROVED)) {
        throw new BadRequestError("At least one current document must exist and all current documents must be approved");
      }
      request.verifiedAt = new Date();
    }
    if (dto.status === ServiceRequestStatus.APPROVED) request.approvedAt = new Date();
    if (dto.status === ServiceRequestStatus.REJECTED) { request.rejectionReason = dto.reason; request.rejectedAt = new Date(); }
    if (dto.status === ServiceRequestStatus.MORE_INFO_REQUIRED) request.moreInfoReason = dto.reason;
    request.status = dto.status;
    request.reviewedBy = new Types.ObjectId(adminId);
    await this.repository.saveRequest(request);

    if (dto.status === ServiceRequestStatus.UNDER_REVIEW) await this.repository.setPlanStatus(request.plan, PlanStatus.UNDER_REVIEW);
    if (dto.status === ServiceRequestStatus.APPROVED) await this.repository.setPlanStatus(request.plan, PlanStatus.APPROVED);
    const notificationEvents: Partial<Record<ServiceRequestStatus, NotificationEvent>> = {
      [ServiceRequestStatus.DOCS_VERIFIED]: NotificationEvent.SERVICE_DOCUMENTS_APPROVED,
      [ServiceRequestStatus.APPROVED]: NotificationEvent.SERVICE_REQUEST_APPROVED,
      [ServiceRequestStatus.REJECTED]: NotificationEvent.SERVICE_REQUEST_REJECTED,
      [ServiceRequestStatus.MORE_INFO_REQUIRED]: NotificationEvent.SERVICE_MORE_INFO_REQUIRED,
    };
    const notification = notificationEvents[dto.status];
    if (notification) await this.notifications.record(request.owner.toString(), request.plan.toString(), notification, `${request._id}:${dto.status}`);
    await this.audit.record({ actorId: adminId, action: `service_request.${dto.status.toLowerCase()}`, resourceType: "ServiceRequest", resourceId: request._id.toString(), metadata: dto.reason ? { reason: dto.reason } : undefined });
    return request;
  }
}
