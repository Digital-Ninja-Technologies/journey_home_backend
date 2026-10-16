// Imports mongoose from mongoose.
import mongoose, { Types } from "mongoose";
// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";
// Imports NotFoundError from ../../../common/errors/NotFoundError.
import { NotFoundError } from "../../../common/errors/NotFoundError";
// Imports ForbiddenError from ../../../common/errors/ForbiddenError.
import { ForbiddenError } from "../../../common/errors/ForbiddenError";
// Imports FilePurpose, FileStatus from ../../file/models/file.model.
import { FilePurpose, FileStatus } from "../../file/models/file.model";
// Imports FileService from ../../file/services/file.service.
import { FileService } from "../../file/services/file.service";
// Imports FileRepository from ../../file/repositories/file.repository.
import { FileRepository } from "../../file/repositories/file.repository";
// Imports PlanStatus from ../../plans/models/plan.model.
import { PlanStatus } from "../../plans/models/plan.model";
// Imports AuditLogService from ../../audit/services/audit-log.service.
import { AuditLogService } from "../../audit/services/audit-log.service";
// Imports NotificationService from ../../notifications/services/notification.service.
import { NotificationService } from "../../notifications/services/notification.service";
// Imports NotificationEvent from ../../notifications/models/notification.model.
import { NotificationEvent } from "../../notifications/models/notification.model";
// Provides the next part of the surrounding operation.
import {
  // Provides the next part of the surrounding operation.
  ServiceDocumentStatus,
  // Provides the next part of the surrounding operation.
  ServiceRequestStatus,
  // Provides the next part of the surrounding operation.
  IServiceRequest,
  // Provides the next part of the surrounding operation.
  IServiceDocument,
// Closes the current block.
} from "../models/service-request.model";
// Imports ServiceRequestRepository from ../repositories/service-request.repository.
import { ServiceRequestRepository } from "../repositories/service-request.repository";

// Declares the service class that groups related application operations.
export class ServiceRequestService {
  // Provides the next part of the surrounding operation.
  private files = new FileService();
  // Provides the next part of the surrounding operation.
  private fileRepo = new FileRepository();
  // Provides the next part of the surrounding operation.
  private audit = new AuditLogService();
  // Provides the next part of the surrounding operation.
  private notifications = new NotificationService();
  // Provides the next part of the surrounding operation.
  private repository = new ServiceRequestRepository();

  // Creates the requested record and coordinates its related work.
  // Declares a function or method used by this service.
  async create(ownerId: string, dto: any): Promise<IServiceRequest> {
    // Stores the result of this.repository.findPlanForOwner in plan.
    const plan = await this.repository.findPlanForOwner(dto.planId, ownerId);

    // Runs the following branch when !plan) throw new NotFoundError("Plan not found" is true.
    if (!plan) throw new NotFoundError("Plan not found");

    // Calls if to perform the next step.
    if (
      // Provides the next part of the surrounding operation.
      ![PlanStatus.ACTIVE, PlanStatus.PAYMENT_DUE, PlanStatus.OVERDUE].includes(
        // Provides the next part of the surrounding operation.
        plan.status,
      // Provides the next part of the surrounding operation.
      )
    // Provides the next part of the surrounding operation.
    ) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(
        // Provides the next part of the surrounding operation.
        "Service requests can only be opened for active or payment-due plans",
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }

    // Stores the result of Types.ObjectId in newOwnerId.
    const newOwnerId = new Types.ObjectId(ownerId);

    // Stores the result of this.repository.create in request.
    const request = await this.repository.create({
      // Declares the owner property with type or value newOwnerId,.
      owner: newOwnerId,
      // Declares the plan property with type or value plan._id,.
      plan: plan._id,
      // Declares the coveredPersonSnapshot property with type or value plan.coveredPerson,.
      coveredPersonSnapshot: plan.coveredPerson,
      // Declares the dateOfDeath property with type or value new Date(dto.dateOfDeath),.
      dateOfDeath: new Date(dto.dateOfDeath),
      // Declares the burialLocation property with type or value dto.burialLocation,.
      burialLocation: dto.burialLocation,
      // Declares the expectedBurialDate property with type or value new Date(dto.expectedBurialDate),.
      expectedBurialDate: new Date(dto.expectedBurialDate),
      // Declares the contactPerson property with type or value dto.contactPerson,.
      contactPerson: dto.contactPerson,
      // Declares the contactPhone property with type or value dto.contactPhone,.
      contactPhone: dto.contactPhone,
      // Declares the additionalInformation property with type or value dto.additionalInformation,.
      additionalInformation: dto.additionalInformation,
      // Declares the status property with type or value ServiceRequestStatus.SUBMITTED,.
      status: ServiceRequestStatus.SUBMITTED,
    // Closes the current block.
    });

    // Waits for repository.setPlanStatus to finish before continuing.
    await this.repository.setPlanStatus(plan._id, PlanStatus.SERVICE_REQUEST);
    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value ownerId,.
      actorId: ownerId,
      // Declares the action property with type or value "service_request.created",.
      action: "service_request.created",
      // Declares the resourceType property with type or value "ServiceRequest",.
      resourceType: "ServiceRequest",
      // Declares the resourceId property with type or value request._id.toString(),.
      resourceId: request._id.toString(),
      // Declares the metadata property with type or value { planId: plan._id.toString() },.
      metadata: { planId: plan._id.toString() },
    // Closes the current block.
    });
    // Waits for notifications.record to finish before continuing.
    await this.notifications.record(
      // Provides the next part of the surrounding operation.
      ownerId,
      // Calls plan._id.toString to perform the next step.
      plan._id.toString(),
      // Provides the next part of the surrounding operation.
      NotificationEvent.SERVICE_REQUEST_RECEIVED,
      // Provides the next part of the surrounding operation.
      `${request._id}:received`,
    // Provides the next part of the surrounding operation.
    );
    // Returns request to the caller.
    return request;
  // Closes the current block.
  }

  // Returns records belonging to the current user.
  // Declares a function or method used by this service.
  async listMine(ownerId: string): Promise<IServiceRequest[]> {
    // Returns this.repository.listMine(ownerId) to the caller.
    return this.repository.listMine(ownerId);
  // Closes the current block.
  }

  // Returns all records in newest-first order.
  // Declares a function or method used by this service.
  async listAll(status?: string): Promise<IServiceRequest[]> {
    // Defines validStatus using the value on the right-hand side.
    const validStatus =
      // Provides the next part of the surrounding operation.
      status &&
      // Calls Object.values to perform the next step.
      Object.values(ServiceRequestStatus).includes(
        // Provides the next part of the surrounding operation.
        status as ServiceRequestStatus,
      // Provides the next part of the surrounding operation.
      )
        // Provides the next part of the surrounding operation.
        ? (status as ServiceRequestStatus)
        // Provides the next part of the surrounding operation.
        : undefined;
    // Returns this.repository.listAll(validStatus) to the caller.
    return this.repository.listAll(validStatus);
  // Closes the current block.
  }

  // Returns the requested value or record.
  // Declares a function or method used by this service.
  async getForUser(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the userId property with type or value string,.
    userId: string,
    // Declares the isAdmin property with type or value boolean,.
    isAdmin: boolean,
  // Provides the next part of the surrounding operation.
  ): Promise<{ request: IServiceRequest; documents: IServiceDocument[] }> {
    // Runs the following branch when !Types.ObjectId.isValid(requestId) is true.
    if (!Types.ObjectId.isValid(requestId))
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Invalid service request id");

    // Defines query using the value on the right-hand side.
    const query = isAdmin
      // Provides the next part of the surrounding operation.
      ? { _id: requestId }
      // Provides the next part of the surrounding operation.
      : { _id: requestId, owner: userId };

    // Stores the result of this.repository.findRequest in request.
    const request = await this.repository.findRequest(query);

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Stores the result of this.repository.listDocuments in documents.
    const documents = await this.repository.listDocuments(request._id);

    // Runs the following branch when isAdmin is true.
    if (isAdmin) {
      // Waits for audit.record to finish before continuing.
      await this.audit.record({
        // Declares the actorId property with type or value userId,.
        actorId: userId,
        // Declares the action property with type or value "service_request.viewed_by_admin",.
        action: "service_request.viewed_by_admin",
        // Declares the resourceType property with type or value "ServiceRequest",.
        resourceType: "ServiceRequest",
        // Declares the resourceId property with type or value request._id.toString(),.
        resourceId: request._id.toString(),
      // Closes the current block.
      });
    // Closes the current block.
    }
    // Returns { request, documents } to the caller.
    return { request, documents };
  // Closes the current block.
  }

  // Creates an upload request for a service-request document.
  // Declares a function or method used by this service.
  async requestDocumentUpload(requestId: string, ownerId: string, dto: any) {
    // Stores the result of this.repository.findRequest in request.
    const request = await this.repository.findRequest({
      // Declares the _id property with type or value requestId,.
      _id: requestId,
      // Declares the owner property with type or value ownerId,.
      owner: ownerId,
    // Closes the current block.
    });

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Calls if to perform the next step.
    if (
      // Provides the next part of the surrounding operation.
      [
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.APPROVED,
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.REJECTED,
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.CANCELLED,
      // Provides the next part of the surrounding operation.
      ].includes(request.status)
    // Provides the next part of the surrounding operation.
    ) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(
        // Provides the next part of the surrounding operation.
        "Documents cannot be uploaded for this service request status",
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }

    // Returns this.files.requestUploadUrl({ to the caller.
    return this.files.requestUploadUrl({
      // Declares the fileName property with type or value dto.fileName,.
      fileName: dto.fileName,
      // Declares the contentType property with type or value dto.contentType,.
      contentType: dto.contentType,
      // Declares the size property with type or value dto.size,.
      size: dto.size,
      // Declares the purpose property with type or value FilePurpose.SERVICE_DOCUMENT,.
      purpose: FilePurpose.SERVICE_DOCUMENT,
      // Provides the next part of the surrounding operation.
      ownerId,
      // Declares the entityId property with type or value request._id.toString(),.
      entityId: request._id.toString(),
    // Closes the current block.
    });
  // Closes the current block.
  }

  // Completes a document upload and records the resulting document.
  // Declares a function or method used by this service.
  async completeDocumentUpload(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the ownerId property with type or value string,.
    ownerId: string,
    // Declares the dto property with type or value any,.
    dto: any,
  // Provides the next part of the surrounding operation.
  ): Promise<IServiceDocument> {
    // Stores the result of this.repository.findRequest in request.
    const request = await this.repository.findRequest({
      // Declares the _id property with type or value requestId,.
      _id: requestId,
      // Declares the owner property with type or value ownerId,.
      owner: ownerId,
    // Closes the current block.
    });

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Calls if to perform the next step.
    if (
      // Provides the next part of the surrounding operation.
      [
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.APPROVED,
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.REJECTED,
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.CANCELLED,
      // Provides the next part of the surrounding operation.
      ].includes(request.status)
    // Provides the next part of the surrounding operation.
    ) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(
        // Provides the next part of the surrounding operation.
        "Documents cannot be uploaded for this service request status",
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }

    // Stores the result of this.fileRepo.findById in file.
    const file = await this.fileRepo.findById(dto.fileId);
    // Calls if to perform the next step.
    if (
      // Provides the next part of the surrounding operation.
      !file ||
      // Provides the next part of the surrounding operation.
      file.owner?.toString() !== ownerId ||
      // Provides the next part of the surrounding operation.
      file.entityId !== request._id.toString()
    // Provides the next part of the surrounding operation.
    ) {
      // Raises ForbiddenError to report an invalid or failed operation.
      throw new ForbiddenError("File does not belong to this service request");
    // Closes the current block.
    }

    // Stores the result of this.files.completeUpload in completed.
    const completed = await this.files.completeUpload(
      // Provides the next part of the surrounding operation.
      dto.fileId,
      // Provides the next part of the surrounding operation.
      dto.uploadToken,
      // Calls request._id.toString to perform the next step.
      request._id.toString(),
    // Provides the next part of the surrounding operation.
    );

    // Runs the following branch when completed.file.status !== FileStatus.UPLOADED is true.
    if (completed.file.status !== FileStatus.UPLOADED)
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("File upload was not completed");

    // Provides the next part of the surrounding operation.
    let replacedDocument: IServiceDocument | null = null;

    // Runs the following branch when dto.replacesDocumentId is true.
    if (dto.replacesDocumentId) {
      // Updates replacedDocument with the value on the right-hand side.
      replacedDocument = await this.repository.findDocument({
        // Declares the _id property with type or value dto.replacesDocumentId,.
        _id: dto.replacesDocumentId,
        // Declares the serviceRequest property with type or value request._id,.
        serviceRequest: request._id,
        // Declares the owner property with type or value ownerId,.
        owner: ownerId,
      // Closes the current block.
      });

      // Runs the following branch when !replacedDocument is true.
      if (!replacedDocument)
        // Raises NotFoundError to report an invalid or failed operation.
        throw new NotFoundError("Document to replace not found");
    // Closes the current block.
    }
    // Stores the result of Types.ObjectId in newOwnerId.
    const newOwnerId = new Types.ObjectId(ownerId);

    // Stores the result of mongoose.startSession in session.
    const session = await mongoose.startSession();
    // Starts an operation whose errors are handled below.
    try {
      // Provides the next part of the surrounding operation.
      let document!: IServiceDocument;

      // Waits for session.withTransaction to finish before continuing.
      await session.withTransaction(async () => {
        // Updates document with the value on the right-hand side.
        document = await this.repository.createDocument(
          // Opens the block for the declaration or control flow above.
          {
            // Declares the serviceRequest property with type or value request._id,.
            serviceRequest: request._id,
            // Declares the owner property with type or value newOwnerId,.
            owner: newOwnerId,
            // Declares the plan property with type or value request.plan,.
            plan: request.plan,
            // Declares the file property with type or value completed.file._id,.
            file: completed.file._id,
            // Declares the documentType property with type or value dto.documentType,.
            documentType: dto.documentType,
            // Declares the verificationStatus property with type or value ServiceDocumentStatus.PENDING,.
            verificationStatus: ServiceDocumentStatus.PENDING,
          // Closes the current block.
          },
          // Provides the next part of the surrounding operation.
          session,
        // Provides the next part of the surrounding operation.
        );

        // Runs the following branch when replacedDocument is true.
        if (replacedDocument) {
          // Waits for repository.markDocumentReplaced to finish before continuing.
          await this.repository.markDocumentReplaced(
            // Provides the next part of the surrounding operation.
            replacedDocument._id,
            // Provides the next part of the surrounding operation.
            document._id,
            // Provides the next part of the surrounding operation.
            session,
          // Provides the next part of the surrounding operation.
          );
        // Closes the current block.
        }

        // Waits for repository.resetForResubmission to finish before continuing.
        await this.repository.resetForResubmission(request._id, session);
      // Closes the current block.
      });

      // Waits for audit.record to finish before continuing.
      await this.audit.record({
        // Declares the actorId property with type or value ownerId,.
        actorId: ownerId,
        // Declares the action property with type or value replacedDocument.
        action: replacedDocument
          // Provides the next part of the surrounding operation.
          ? "service_document.resubmitted"
          // Provides the next part of the surrounding operation.
          : "service_document.uploaded",
        // Declares the resourceType property with type or value "ServiceDocument",.
        resourceType: "ServiceDocument",
        // Declares the resourceId property with type or value document._id.toString(),.
        resourceId: document._id.toString(),
        // Declares the metadata property with type or value {.
        metadata: {
          // Declares the serviceRequestId property with type or value request._id.toString(),.
          serviceRequestId: request._id.toString(),
          // Declares the documentType property with type or value dto.documentType,.
          documentType: dto.documentType,
        // Closes the current block.
        },
      // Closes the current block.
      });

      // Returns document to the caller.
      return document;
    // Closes the current block.
    } finally {
      // Waits for session.endSession to finish before continuing.
      await session.endSession();
    // Closes the current block.
    }
  // Closes the current block.
  }

  // Authorizes and returns a temporary download link for a document.
  // Declares a function or method used by this service.
  async getDocumentDownload(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the documentId property with type or value string,.
    documentId: string,
    // Declares the userId property with type or value string,.
    userId: string,
    // Declares the isAdmin property with type or value boolean,.
    isAdmin: boolean,
  // Provides the next part of the surrounding operation.
  ) {
    // Defines query using the value on the right-hand side.
    const query = isAdmin
      // Provides the next part of the surrounding operation.
      ? { _id: requestId }
      // Provides the next part of the surrounding operation.
      : { _id: requestId, owner: userId };

    // Stores the result of this.repository.findRequest in request.
    const request = await this.repository.findRequest(query);

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Stores the result of this.repository.findDocument in document.
    const document = await this.repository.findDocument({
      // Declares the _id property with type or value documentId,.
      _id: documentId,
      // Declares the serviceRequest property with type or value request._id,.
      serviceRequest: request._id,
    // Closes the current block.
    });

    // Runs the following branch when !document) throw new NotFoundError("Document not found" is true.
    if (!document) throw new NotFoundError("Document not found");

    // Stores the result of this.files.getFileById in result.
    const result = await this.files.getFileById(document.file.toString());

    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value userId,.
      actorId: userId,
      // Declares the action property with type or value isAdmin.
      action: isAdmin
        // Provides the next part of the surrounding operation.
        ? "service_document.viewed_by_admin"
        // Provides the next part of the surrounding operation.
        : "service_document.viewed_by_owner",
      // Declares the resourceType property with type or value "ServiceDocument",.
      resourceType: "ServiceDocument",
      // Declares the resourceId property with type or value document._id.toString(),.
      resourceId: document._id.toString(),
    // Closes the current block.
    });

    // Returns { document, url: result.url, expiresIn: 900 } to the caller.
    return { document, url: result.url, expiresIn: 900 };
  // Closes the current block.
  }

  // Moves a service request into the review state.
  // Declares a function or method used by this service.
  async markUnderReview(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the adminId property with type or value string,.
    adminId: string,
  // Provides the next part of the surrounding operation.
  ): Promise<IServiceRequest> {
    // Stores the result of this.adminUpdateStatus in request.
    const request = await this.adminUpdateStatus(
      // Provides the next part of the surrounding operation.
      requestId,
      // Provides the next part of the surrounding operation.
      adminId,
      // Provides the next part of the surrounding operation.
      ServiceRequestStatus.UNDER_REVIEW,
    // Provides the next part of the surrounding operation.
    );

    // Waits for repository.setPlanStatus to finish before continuing.
    await this.repository.setPlanStatus(request.plan, PlanStatus.UNDER_REVIEW);

    // Returns request to the caller.
    return request;
  // Closes the current block.
  }

  // Updates a document verification result and records the review.
  // Declares a function or method used by this service.
  async verifyDocument(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the documentId property with type or value string,.
    documentId: string,
    // Declares the adminId property with type or value string,.
    adminId: string,
    // Declares the dto property with type or value any,.
    dto: any,
  // Provides the next part of the surrounding operation.
  ): Promise<IServiceDocument> {
    // Stores the result of this.repository.findRequestById in request.
    const request = await this.repository.findRequestById(requestId);

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Stores the result of this.repository.findDocument in document.
    const document = await this.repository.findDocument({
      // Declares the _id property with type or value documentId,.
      _id: documentId,
      // Declares the serviceRequest property with type or value request._id,.
      serviceRequest: request._id,
    // Closes the current block.
    });

    // Runs the following branch when !document) throw new NotFoundError("Document not found" is true.
    if (!document) throw new NotFoundError("Document not found");

    // Updates document.verificationStatus with the value on the right-hand side.
    document.verificationStatus = dto.verificationStatus;
    // Updates document.rejectionReason with the value on the right-hand side.
    document.rejectionReason = dto.reason;
    // Updates document.verifiedAt with the value on the right-hand side.
    document.verifiedAt = new Date();
    // Updates document.verifiedBy with the value on the right-hand side.
    document.verifiedBy = new Types.ObjectId(adminId);
    // Waits for repository.saveDocument to finish before continuing.
    await this.repository.saveDocument(document);

    // Calls if to perform the next step.
    if (
      // Updates dto.verificationStatus with the value on the right-hand side.
      dto.verificationStatus === ServiceDocumentStatus.REQUIRES_RESUBMISSION
    // Provides the next part of the surrounding operation.
    ) {
      // Updates request.status with the value on the right-hand side.
      request.status = ServiceRequestStatus.MORE_INFO_REQUIRED;
      // Updates request.moreInfoReason with the value on the right-hand side.
      request.moreInfoReason = dto.reason;

      // Waits for repository.saveRequest to finish before continuing.
      await this.repository.saveRequest(request);

      // Waits for notifications.record to finish before continuing.
      await this.notifications.record(
        // Calls request.owner.toString to perform the next step.
        request.owner.toString(),
        // Calls request.plan.toString to perform the next step.
        request.plan.toString(),
        // Provides the next part of the surrounding operation.
        NotificationEvent.SERVICE_DOCUMENTS_REJECTED,
        // Provides the next part of the surrounding operation.
        `${document._id}:requires_resubmission`,
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }

    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value adminId,.
      actorId: adminId,
      // Declares the action property with type or value .
      action:
        // Updates dto.verificationStatus with the value on the right-hand side.
        dto.verificationStatus === ServiceDocumentStatus.APPROVED
          // Provides the next part of the surrounding operation.
          ? "service_document.approved"
          // Provides the next part of the surrounding operation.
          : "service_document.requires_resubmission",
      // Declares the resourceType property with type or value "ServiceDocument",.
      resourceType: "ServiceDocument",
      // Declares the resourceId property with type or value document._id.toString(),.
      resourceId: document._id.toString(),

      // Declares the metadata property with type or value {.
      metadata: {
        // Declares the serviceRequestId property with type or value request._id.toString(),.
        serviceRequestId: request._id.toString(),
        // Declares the reason property with type or value dto.reason,.
        reason: dto.reason,
      // Closes the current block.
      },
    // Closes the current block.
    });
    // Returns document to the caller.
    return document;
  // Closes the current block.
  }

  // Confirms all current documents are approved and marks them verified.
  // Declares a function or method used by this service.
  async markDocsVerified(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the adminId property with type or value string,.
    adminId: string,
  // Provides the next part of the surrounding operation.
  ): Promise<IServiceRequest> {
    // Stores the result of this.repository.findRequestById in request.
    const request = await this.repository.findRequestById(requestId);

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Stores the result of this.repository.listCurrentDocuments in documents.
    const documents = await this.repository.listCurrentDocuments(request._id);

    // Runs the following branch when documents.length === 0 is true.
    if (documents.length === 0)
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(
        // Provides the next part of the surrounding operation.
        "At least one document is required before verification",
      // Provides the next part of the surrounding operation.
      );

    // Calls if to perform the next step.
    if (
      // Calls documents.some to perform the next step.
      documents.some(
        // Provides the next part of the surrounding operation.
        (doc) => doc.verificationStatus !== ServiceDocumentStatus.APPROVED,
      // Provides the next part of the surrounding operation.
      )
    // Provides the next part of the surrounding operation.
    ) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(
        // Provides the next part of the surrounding operation.
        "All current documents must be approved before marking docs verified",
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }

    // Updates request.status with the value on the right-hand side.
    request.status = ServiceRequestStatus.DOCS_VERIFIED;
    // Updates request.verifiedAt with the value on the right-hand side.
    request.verifiedAt = new Date();
    // Updates request.reviewedBy with the value on the right-hand side.
    request.reviewedBy = new Types.ObjectId(adminId);

    // Waits for repository.saveRequest to finish before continuing.
    await this.repository.saveRequest(request);

    // Waits for notifications.record to finish before continuing.
    await this.notifications.record(
      // Calls request.owner.toString to perform the next step.
      request.owner.toString(),
      // Calls request.plan.toString to perform the next step.
      request.plan.toString(),
      // Provides the next part of the surrounding operation.
      NotificationEvent.SERVICE_DOCUMENTS_APPROVED,
      // Provides the next part of the surrounding operation.
      `${request._id}:docs_verified`,
    // Provides the next part of the surrounding operation.
    );

    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value adminId,.
      actorId: adminId,
      // Declares the action property with type or value "service_request.docs_verified",.
      action: "service_request.docs_verified",
      // Declares the resourceType property with type or value "ServiceRequest",.
      resourceType: "ServiceRequest",
      // Declares the resourceId property with type or value request._id.toString(),.
      resourceId: request._id.toString(),
    // Closes the current block.
    });

    // Returns request to the caller.
    return request;
  // Closes the current block.
  }

  // Approves a service request and updates its related plan.
  // Declares a function or method used by this service.
  async approve(requestId: string, adminId: string): Promise<IServiceRequest> {
    // Stores the result of this.repository.findRequestById in request.
    const request = await this.repository.findRequestById(requestId);

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Calls if to perform the next step.
    if (
      // Provides the next part of the surrounding operation.
      ![
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.DOCS_VERIFIED,
        // Provides the next part of the surrounding operation.
        ServiceRequestStatus.UNDER_REVIEW,
      // Provides the next part of the surrounding operation.
      ].includes(request.status)
    // Provides the next part of the surrounding operation.
    ) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(
        // Provides the next part of the surrounding operation.
        "Documents must be verified or under review before approval",
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }

    // Updates request.status with the value on the right-hand side.
    request.status = ServiceRequestStatus.APPROVED;
    // Updates request.approvedAt with the value on the right-hand side.
    request.approvedAt = new Date();
    // Updates request.reviewedBy with the value on the right-hand side.
    request.reviewedBy = new Types.ObjectId(adminId);

    // Waits for repository.saveRequest to finish before continuing.
    await this.repository.saveRequest(request);

    // Waits for repository.setPlanStatus to finish before continuing.
    await this.repository.setPlanStatus(request.plan, PlanStatus.APPROVED);

    // Waits for notifications.record to finish before continuing.
    await this.notifications.record(
      // Calls request.owner.toString to perform the next step.
      request.owner.toString(),
      // Calls request.plan.toString to perform the next step.
      request.plan.toString(),
      // Provides the next part of the surrounding operation.
      NotificationEvent.SERVICE_REQUEST_APPROVED,
      // Provides the next part of the surrounding operation.
      `${request._id}:approved`,
    // Provides the next part of the surrounding operation.
    );

    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value adminId,.
      actorId: adminId,
      // Declares the action property with type or value "service_request.approved",.
      action: "service_request.approved",
      // Declares the resourceType property with type or value "ServiceRequest",.
      resourceType: "ServiceRequest",
      // Declares the resourceId property with type or value request._id.toString(),.
      resourceId: request._id.toString(),
    // Closes the current block.
    });

    // Returns request to the caller.
    return request;
  // Closes the current block.
  }

  // Rejects a service request and records the supplied reason.
  // Declares a function or method used by this service.
  async reject(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the adminId property with type or value string,.
    adminId: string,
    // Declares the reason property with type or value string,.
    reason?: string,
  // Provides the next part of the surrounding operation.
  ): Promise<IServiceRequest> {
    // Runs the following branch when !reason) throw new BadRequestError("Rejection reason is required" is true.
    if (!reason) throw new BadRequestError("Rejection reason is required");

    // Stores the result of this.repository.updateRequest in request.
    const request = await this.repository.updateRequest(requestId, {
      // Declares the $set property with type or value {.
      $set: {
        // Declares the status property with type or value ServiceRequestStatus.REJECTED,.
        status: ServiceRequestStatus.REJECTED,
        // Declares the rejectionReason property with type or value reason,.
        rejectionReason: reason,
        // Declares the rejectedAt property with type or value new Date(),.
        rejectedAt: new Date(),
        // Declares the reviewedBy property with type or value adminId,.
        reviewedBy: adminId,
      // Closes the current block.
      },
    // Closes the current block.
    });

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Waits for notifications.record to finish before continuing.
    await this.notifications.record(
      // Calls request.owner.toString to perform the next step.
      request.owner.toString(),
      // Calls request.plan.toString to perform the next step.
      request.plan.toString(),
      // Provides the next part of the surrounding operation.
      NotificationEvent.SERVICE_REQUEST_REJECTED,
      // Provides the next part of the surrounding operation.
      `${request._id}:rejected`,
    // Provides the next part of the surrounding operation.
    );

    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value adminId,.
      actorId: adminId,
      // Declares the action property with type or value "service_request.rejected",.
      action: "service_request.rejected",
      // Declares the resourceType property with type or value "ServiceRequest",.
      resourceType: "ServiceRequest",
      // Declares the resourceId property with type or value request._id.toString(),.
      resourceId: request._id.toString(),
      // Declares the metadata property with type or value { reason },.
      metadata: { reason },
    // Closes the current block.
    });

    // Returns request to the caller.
    return request;
  // Closes the current block.
  }

  // Requests additional information for a service request.
  // Declares a function or method used by this service.
  async requestMoreInfo(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the adminId property with type or value string,.
    adminId: string,
    // Declares the reason property with type or value string,.
    reason: string,
  // Provides the next part of the surrounding operation.
  ): Promise<IServiceRequest> {
    // Stores the result of this.repository.updateRequest in request.
    const request = await this.repository.updateRequest(requestId, {
      // Declares the $set property with type or value {.
      $set: {
        // Declares the status property with type or value ServiceRequestStatus.MORE_INFO_REQUIRED,.
        status: ServiceRequestStatus.MORE_INFO_REQUIRED,
        // Declares the moreInfoReason property with type or value reason,.
        moreInfoReason: reason,
        // Declares the reviewedBy property with type or value adminId,.
        reviewedBy: adminId,
      // Closes the current block.
      },
    // Closes the current block.
    });

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");
    // Waits for notifications.record to finish before continuing.
    await this.notifications.record(
      // Calls request.owner.toString to perform the next step.
      request.owner.toString(),
      // Calls request.plan.toString to perform the next step.
      request.plan.toString(),
      // Provides the next part of the surrounding operation.
      NotificationEvent.SERVICE_MORE_INFO_REQUIRED,
      // Provides the next part of the surrounding operation.
      `${request._id}:more_info`,
    // Provides the next part of the surrounding operation.
    );

    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value adminId,.
      actorId: adminId,
      // Declares the action property with type or value "service_request.more_info_required",.
      action: "service_request.more_info_required",
      // Declares the resourceType property with type or value "ServiceRequest",.
      resourceType: "ServiceRequest",
      // Declares the resourceId property with type or value request._id.toString(),.
      resourceId: request._id.toString(),
      // Declares the metadata property with type or value { reason },.
      metadata: { reason },
    // Closes the current block.
    });

    // Returns request to the caller.
    return request;
  // Closes the current block.
  }

  // Changes a service-request status and records the administrator action.
  // Provides the next part of the surrounding operation.
  private async adminUpdateStatus(
    // Declares the requestId property with type or value string,.
    requestId: string,
    // Declares the adminId property with type or value string,.
    adminId: string,
    // Declares the status property with type or value ServiceRequestStatus,.
    status: ServiceRequestStatus,
  // Provides the next part of the surrounding operation.
  ): Promise<IServiceRequest> {
    // Stores the result of this.repository.updateRequest in request.
    const request = await this.repository.updateRequest(requestId, {
      // Declares the $set property with type or value { status, reviewedBy: adminId },.
      $set: { status, reviewedBy: adminId },
    // Closes the current block.
    });

    // Runs the following branch when !request) throw new NotFoundError("Service request not found" is true.
    if (!request) throw new NotFoundError("Service request not found");

    // Waits for audit.record to finish before continuing.
    await this.audit.record({
      // Declares the actorId property with type or value adminId,.
      actorId: adminId,
      // Declares the action property with type or value `service_request.${status.toLowerCase()}`,.
      action: `service_request.${status.toLowerCase()}`,
      // Declares the resourceType property with type or value "ServiceRequest",.
      resourceType: "ServiceRequest",
      // Declares the resourceId property with type or value request._id.toString(),.
      resourceId: request._id.toString(),
    // Closes the current block.
    });

    // Returns request to the caller.
    return request;
  // Closes the current block.
  }
// Closes the current block.
}
