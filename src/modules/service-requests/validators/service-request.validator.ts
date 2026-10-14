import { z } from "zod";
import { ServiceDocumentStatus, ServiceDocumentType, ServiceRequestStatus } from "../models/service-request.model";

export const CreateServiceRequestValidator = z.object({
  planId: z.string().min(1),
  dateOfDeath: z.string().datetime(),
  burialLocation: z.string().trim().min(3),
  expectedBurialDate: z.string().datetime(),
  contactPerson: z.string().trim().min(2),
  contactPhone: z.string().trim().min(5),
  additionalInformation: z.string().trim().optional(),
});

export const RequestServiceDocumentUploadValidator = z.object({
  documentType: z.nativeEnum(ServiceDocumentType),
  fileName: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  size: z.number().positive(),
});

export const CompleteServiceDocumentUploadValidator = z.object({
  fileId: z.string().min(1),
  uploadToken: z.string().min(1),
  documentType: z.nativeEnum(ServiceDocumentType),
  replacesDocumentId: z.string().optional(),
});

export const VerifyServiceDocumentValidator = z.object({
  verificationStatus: z.enum([ServiceDocumentStatus.APPROVED, ServiceDocumentStatus.REQUIRES_RESUBMISSION]),
  reason: z.string().trim().optional(),
}).refine((value) => value.verificationStatus !== ServiceDocumentStatus.REQUIRES_RESUBMISSION || Boolean(value.reason), {
  message: "reason is required when requesting resubmission",
});

export const ReviewServiceRequestValidator = z.object({
  reason: z.string().trim().optional(),
}).optional();

export const RequestMoreInfoValidator = z.object({
  reason: z.string().trim().min(3),
});

export const AdminRequestStatusValidator = z.object({
  status: z.enum([ServiceRequestStatus.UNDER_REVIEW, ServiceRequestStatus.CANCELLED]),
});
