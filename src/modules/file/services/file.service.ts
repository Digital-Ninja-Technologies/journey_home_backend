import crypto from "crypto";
import { FileRepository } from "../repositories/file.repository";
import { StorageService } from "./storage.service";
import { FilePurpose, FileStatus, IFile } from "../models/file.model";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";

export interface PurposeRule {
  maxSizeBytes: number;
  allowedMimeTypes: string[];
  keyPrefix: string;
  privateOnly: boolean;
}

export const PURPOSE_RULES: Record<FilePurpose, PurposeRule> = {
  [FilePurpose.SERVICE_DOCUMENT]: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    keyPrefix: "service-requests/documents",
    privateOnly: true,
  },
  [FilePurpose.PROFILE_IMAGE]: {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    keyPrefix: "profiles",
    privateOnly: true,
  },
  [FilePurpose.DOCUMENT]: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ],
    keyPrefix: "documents",
    privateOnly: true,
  },
  [FilePurpose.OTHER]: {
    maxSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: [],
    keyPrefix: "uploads",
    privateOnly: true,
  },
};

export class FileService {
  private fileRepo = new FileRepository();
  private storageService = new StorageService();

  async requestUploadUrl(input: {
    fileName: string;
    contentType: string;
    size: number;
    purpose: FilePurpose;
    ownerId?: string;
    entityId?: string;
  }): Promise<{
    fileId: string;
    uploadUrl: string;
    uploadToken: string;
    storageKey: string;
    expiresIn: number;
  }> {
    const { fileName, contentType, size, purpose } = input;

    if (!purpose || !PURPOSE_RULES[purpose]) {
      throw new BadRequestError(`Invalid file purpose: ${purpose}`);
    }

    const rule = PURPOSE_RULES[purpose];
    if (rule.allowedMimeTypes.length > 0 && !rule.allowedMimeTypes.includes(contentType)) {
      throw new BadRequestError(
        `Invalid content type '${contentType}' for purpose '${purpose}'. Allowed types: ${rule.allowedMimeTypes.join(", ")}`,
      );
    }

    if (size <= 0) throw new BadRequestError("File size must be greater than 0 bytes");
    if (size > rule.maxSizeBytes) {
      const maxMb = rule.maxSizeBytes / (1024 * 1024);
      throw new BadRequestError(`File size exceeds maximum allowed limit of ${maxMb} MB for ${purpose}`);
    }

    const parts = fileName.split(".");
    const rawExt = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
    const safeExt = rawExt && /^[a-z0-9]+$/.test(rawExt) ? rawExt : "bin";
    const storageKey = `${rule.keyPrefix}/${crypto.randomUUID()}.${safeExt}`;
    const uploadToken = crypto.randomUUID();

    const fileRecord = await this.fileRepo.create({
      originalName: fileName,
      storageKey,
      mimeType: contentType,
      size,
      purpose,
      uploadToken,
      status: FileStatus.PENDING,
      owner: input.ownerId,
      entityId: input.entityId,
      isPrivate: rule.privateOnly,
    });

    const uploadUrl = await this.storageService.generateUploadUrl(storageKey, contentType);

    return {
      fileId: String(fileRecord._id),
      uploadUrl,
      uploadToken,
      storageKey,
      expiresIn: 3600,
    };
  }

  async completeUpload(fileId: string, uploadToken?: string, entityId?: string): Promise<{ file: IFile; url: string }> {
    const file = await this.fileRepo.findById(fileId);
    if (!file) throw new NotFoundError("File record not found");
    if (file.status === FileStatus.DELETED) throw new BadRequestError("File record has been deleted");
    if (uploadToken && file.uploadToken !== uploadToken) throw new BadRequestError("Invalid file upload completion token");

    if (file.status === FileStatus.UPLOADED) {
      const url = await this.storageService.generateDownloadUrl(file.storageKey);
      return { file, url };
    }

    const rule = PURPOSE_RULES[file.purpose];
    try {
      const head = await this.storageService.headObject(file.storageKey);
      const actualSize = head.contentLength || file.size;
      if (rule && actualSize > rule.maxSizeBytes) {
        try {
          await this.storageService.deleteObject(file.storageKey);
        } catch (_) {}
        await this.fileRepo.updateStatus(fileId, FileStatus.FAILED);
        throw new BadRequestError(`Actual file size exceeds maximum allowed for ${file.purpose}`);
      }

      const updated = await this.fileRepo.updateStatus(fileId, FileStatus.UPLOADED, { actualSize, entityId });
      const url = await this.storageService.generateDownloadUrl(file.storageKey);
      return { file: updated || file, url };
    } catch (error: any) {
      if (error instanceof BadRequestError) throw error;
      await this.fileRepo.updateStatus(fileId, FileStatus.FAILED);
      throw new BadRequestError(`File completion failed. Storage object not found or incomplete: ${error.message || "Object missing"}`);
    }
  }

  async getFileById(fileId: string): Promise<{ file: IFile; url: string }> {
    const file = await this.fileRepo.findById(fileId);
    if (!file) throw new NotFoundError("File not found");
    const url = await this.storageService.generateDownloadUrl(file.storageKey);
    return { file, url };
  }

  async deleteFile(fileId: string): Promise<void> {
    const file = await this.fileRepo.findById(fileId);
    if (!file) throw new NotFoundError("File not found");
    try {
      await this.storageService.deleteObject(file.storageKey);
    } catch (_) {}
    await this.fileRepo.delete(fileId);
  }
}
