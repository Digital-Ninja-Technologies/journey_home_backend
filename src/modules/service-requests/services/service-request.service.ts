import mongoose, { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { ForbiddenError } from "../../../common/errors/ForbiddenError";
import { FilePurpose, FileStatus } from "../../file/models/file.model";
import { FileService } from "../../file/services/file.service";
import { FileRepository } from "../../file/repositories/file.repository";
import { Plan, PlanStatus } from "../../plans/models/plan.model";
import { AuditLogService } from "../../audit/services/audit-log.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { NotificationEvent } from "../../notifications/models/notification.model";
import {
  ServiceDocument,
  ServiceDocumentStatus,
  ServiceRequest,
  ServiceRequestStatus,
  IServiceRequest,
  IServiceDocument,
} from "../models/service-request.model";

export class ServiceRequestService {
  private files = new FileService();
  private fileRepo = new FileRepository();
  private audit = new AuditLogService();
  private notifications = new NotificationService();

  async create(ownerId: string, dto: any): Promise<IServiceRequest> {
    const plan = await Plan.findOne({ _id: dto.planId, owner: ownerId }).exec();
    if (!plan) throw new NotFoundError("Plan not found");
    if (![PlanStatus.ACTIVE, PlanStatus.PAYMENT_DUE, PlanStatus.OVERDUE].includes(plan.status)) {
      throw new BadRequestError("Service requests can only be opened for active or payment-due plans");
    }

    const request = await ServiceRequest.create({
      owner: ownerId,
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

    await Plan.updateOne({ _id: plan._id }, { $set: { status: PlanStatus.SERVICE_REQUEST } }).exec();
    await this.audit.record({
      actorId: ownerId,
      action: "service_request.created",
      resourceType: "ServiceRequest",
      resourceId: request._id.toString(),
      metadata: { planId: plan._id.toString() },
    });
    await this.notifications.record(ownerId, plan._id.toString(), NotificationEvent.SERVICE_REQUEST_RECEIVED, `${request._id}:received`);
    return request;
  }

  async listMine(ownerId: string): Promise<IServiceRequest[]> {
    return ServiceRequest.find({ owner: ownerId }).sort({ createdAt: -1 }).exec();
  }

  async listAll(status?: string): Promise<IServiceRequest[]> {
    const query = status && Object.values(ServiceRequestStatus).includes(status as ServiceRequestStatus)
      ? { status: status as ServiceRequestStatus }
      : {};
    return ServiceRequest.find(query).sort({ createdAt: -1 }).exec();
  }

  async getForUser(requestId: string, userId: string, isAdmin: boolean): Promise<{ request: IServiceRequest; documents: IServiceDocument[] }> {
    if (!Types.ObjectId.isValid(requestId)) throw new BadRequestError("Invalid service request id");
    const query = isAdmin ? { _id: requestId } : { _id: requestId, owner: userId };
    const request = await ServiceRequest.findOne(query).exec();
    if (!request) throw new NotFoundError("Service request not found");
    const documents = await ServiceDocument.find({ serviceRequest: request._id }).sort({ createdAt: -1 }).exec();
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

  async requestDocumentUpload(requestId: string, ownerId: string, dto: any) {
    const request = await ServiceRequest.findOne({ _id: requestId, owner: ownerId }).exec();
    if (!request) throw new NotFoundError("Service request not found");
    if ([ServiceRequestStatus.APPROVED, ServiceRequestStatus.REJECTED, ServiceRequestStatus.CANCELLED].includes(request.status)) {
      throw new BadRequestError("Documents cannot be uploaded for this service request status");
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

  async completeDocumentUpload(requestId: string, ownerId: string, dto: any): Promise<IServiceDocument> {
    const request = await ServiceRequest.findOne({ _id: requestId, owner: ownerId }).exec();
    if (!request) throw new NotFoundError("Service request not found");
    if ([ServiceRequestStatus.APPROVED, ServiceRequestStatus.REJECTED, ServiceRequestStatus.CANCELLED].includes(request.status)) {
      throw new BadRequestError("Documents cannot be uploaded for this service request status");
    }

    const file = await this.fileRepo.findById(dto.fileId);
    if (!file || file.owner?.toString() !== ownerId || file.entityId !== request._id.toString()) {
      throw new ForbiddenError("File does not belong to this service request");
    }

    const completed = await this.files.completeUpload(dto.fileId, dto.uploadToken, request._id.toString());
    if (completed.file.status !== FileStatus.UPLOADED) throw new BadRequestError("File upload was not completed");

    let replacedDocument: IServiceDocument | null = null;
    if (dto.replacesDocumentId) {
      replacedDocument = await ServiceDocument.findOne({
        _id: dto.replacesDocumentId,
        serviceRequest: request._id,
        owner: ownerId,
      }).exec();
      if (!replacedDocument) throw new NotFoundError("Document to replace not found");
    }

    const session = await mongoose.startSession();
    try {
      let document!: IServiceDocument;
      await session.withTransaction(async () => {
        const [created] = await ServiceDocument.create(
          [{
            serviceRequest: request._id,
            owner: ownerId,
            plan: request.plan,
            file: completed.file._id,
            documentType: dto.documentType,
            verificationStatus: ServiceDocumentStatus.PENDING,
          }],
          { session },
        );
        document = created;
        if (replacedDocument) {
          await ServiceDocument.updateOne(
            { _id: replacedDocument._id },
            { $set: { replacedBy: created._id } },
            { session },
          ).exec();
        }
        await ServiceRequest.updateOne(
          { _id: request._id },
          { $set: { status: ServiceRequestStatus.SUBMITTED, moreInfoReason: undefined, resubmittedAt: new Date() } },
          { session },
        ).exec();
      });
      await this.audit.record({
        actorId: ownerId,
        action: replacedDocument ? "service_document.resubmitted" : "service_document.uploaded",
        resourceType: "ServiceDocument",
        resourceId: document._id.toString(),
        metadata: { serviceRequestId: request._id.toString(), documentType: dto.documentType },
      });
      return document;
    } finally {
      await session.endSession();
    }
  }

  async getDocumentDownload(requestId: string, documentId: string, userId: string, isAdmin: boolean) {
    const query = isAdmin ? { _id: requestId } : { _id: requestId, owner: userId };
    const request = await ServiceRequest.findOne(query).exec();
    if (!request) throw new NotFoundError("Service request not found");
    const document = await ServiceDocument.findOne({ _id: documentId, serviceRequest: request._id }).exec();
    if (!document) throw new NotFoundError("Document not found");
    const result = await this.files.getFileById(document.file.toString());
    await this.audit.record({
      actorId: userId,
      action: isAdmin ? "service_document.viewed_by_admin" : "service_document.viewed_by_owner",
      resourceType: "ServiceDocument",
      resourceId: document._id.toString(),
    });
    return { document, url: result.url, expiresIn: 900 };
  }

  async markUnderReview(requestId: string, adminId: string): Promise<IServiceRequest> {
    const request = await this.adminUpdateStatus(requestId, adminId, ServiceRequestStatus.UNDER_REVIEW);
    await Plan.updateOne({ _id: request.plan }, { $set: { status: PlanStatus.UNDER_REVIEW } }).exec();
    return request;
  }

  async verifyDocument(requestId: string, documentId: string, adminId: string, dto: any): Promise<IServiceDocument> {
    const request = await ServiceRequest.findById(requestId).exec();
    if (!request) throw new NotFoundError("Service request not found");
    const document = await ServiceDocument.findOne({ _id: documentId, serviceRequest: request._id }).exec();
    if (!document) throw new NotFoundError("Document not found");

    document.verificationStatus = dto.verificationStatus;
    document.rejectionReason = dto.reason;
    document.verifiedAt = new Date();
    document.verifiedBy = new Types.ObjectId(adminId);
    await document.save();

    if (dto.verificationStatus === ServiceDocumentStatus.REQUIRES_RESUBMISSION) {
      request.status = ServiceRequestStatus.MORE_INFO_REQUIRED;
      request.moreInfoReason = dto.reason;
      await request.save();
      await this.notifications.record(request.owner.toString(), request.plan.toString(), NotificationEvent.SERVICE_DOCUMENTS_REJECTED, `${document._id}:requires_resubmission`);
    }

    await this.audit.record({
      actorId: adminId,
      action: dto.verificationStatus === ServiceDocumentStatus.APPROVED ? "service_document.approved" : "service_document.requires_resubmission",
      resourceType: "ServiceDocument",
      resourceId: document._id.toString(),
      metadata: { serviceRequestId: request._id.toString(), reason: dto.reason },
    });
    return document;
  }

  async markDocsVerified(requestId: string, adminId: string): Promise<IServiceRequest> {
    const request = await ServiceRequest.findById(requestId).exec();
    if (!request) throw new NotFoundError("Service request not found");
    const documents = await ServiceDocument.find({ serviceRequest: request._id, replacedBy: { $exists: false } }).exec();
    if (documents.length === 0) throw new BadRequestError("At least one document is required before verification");
    if (documents.some((doc) => doc.verificationStatus !== ServiceDocumentStatus.APPROVED)) {
      throw new BadRequestError("All current documents must be approved before marking docs verified");
    }
    request.status = ServiceRequestStatus.DOCS_VERIFIED;
    request.verifiedAt = new Date();
    request.reviewedBy = new Types.ObjectId(adminId);
    await request.save();
    await this.notifications.record(request.owner.toString(), request.plan.toString(), NotificationEvent.SERVICE_DOCUMENTS_APPROVED, `${request._id}:docs_verified`);
    await this.audit.record({ actorId: adminId, action: "service_request.docs_verified", resourceType: "ServiceRequest", resourceId: request._id.toString() });
    return request;
  }

  async approve(requestId: string, adminId: string): Promise<IServiceRequest> {
    const request = await ServiceRequest.findById(requestId).exec();
    if (!request) throw new NotFoundError("Service request not found");
    if (![ServiceRequestStatus.DOCS_VERIFIED, ServiceRequestStatus.UNDER_REVIEW].includes(request.status)) {
      throw new BadRequestError("Documents must be verified or under review before approval");
    }
    request.status = ServiceRequestStatus.APPROVED;
    request.approvedAt = new Date();
    request.reviewedBy = new Types.ObjectId(adminId);
    await request.save();
    await Plan.updateOne({ _id: request.plan }, { $set: { status: PlanStatus.APPROVED } }).exec();
    await this.notifications.record(request.owner.toString(), request.plan.toString(), NotificationEvent.SERVICE_REQUEST_APPROVED, `${request._id}:approved`);
    await this.audit.record({ actorId: adminId, action: "service_request.approved", resourceType: "ServiceRequest", resourceId: request._id.toString() });
    return request;
  }

  async reject(requestId: string, adminId: string, reason?: string): Promise<IServiceRequest> {
    if (!reason) throw new BadRequestError("Rejection reason is required");
    const request = await ServiceRequest.findByIdAndUpdate(
      requestId,
      {
        $set: {
          status: ServiceRequestStatus.REJECTED,
          rejectionReason: reason,
          rejectedAt: new Date(),
          reviewedBy: adminId,
        },
      },
      { new: true },
    ).exec();
    if (!request) throw new NotFoundError("Service request not found");
    await this.notifications.record(request.owner.toString(), request.plan.toString(), NotificationEvent.SERVICE_REQUEST_REJECTED, `${request._id}:rejected`);
    await this.audit.record({ actorId: adminId, action: "service_request.rejected", resourceType: "ServiceRequest", resourceId: request._id.toString(), metadata: { reason } });
    return request;
  }

  async requestMoreInfo(requestId: string, adminId: string, reason: string): Promise<IServiceRequest> {
    const request = await ServiceRequest.findByIdAndUpdate(
      requestId,
      { $set: { status: ServiceRequestStatus.MORE_INFO_REQUIRED, moreInfoReason: reason, reviewedBy: adminId } },
      { new: true },
    ).exec();
    if (!request) throw new NotFoundError("Service request not found");
    await this.notifications.record(request.owner.toString(), request.plan.toString(), NotificationEvent.SERVICE_MORE_INFO_REQUIRED, `${request._id}:more_info`);
    await this.audit.record({ actorId: adminId, action: "service_request.more_info_required", resourceType: "ServiceRequest", resourceId: request._id.toString(), metadata: { reason } });
    return request;
  }

  private async adminUpdateStatus(requestId: string, adminId: string, status: ServiceRequestStatus): Promise<IServiceRequest> {
    const request = await ServiceRequest.findByIdAndUpdate(
      requestId,
      { $set: { status, reviewedBy: adminId } },
      { new: true },
    ).exec();
    if (!request) throw new NotFoundError("Service request not found");
    await this.audit.record({ actorId: adminId, action: `service_request.${status.toLowerCase()}`, resourceType: "ServiceRequest", resourceId: request._id.toString() });
    return request;
  }
}
