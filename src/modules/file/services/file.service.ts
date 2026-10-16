// Imports crypto from crypto.
import crypto from "crypto";
// Imports FileRepository from ../repositories/file.repository.
import { FileRepository } from "../repositories/file.repository";
// Imports StorageService from ./storage.service.
import { StorageService } from "./storage.service";
// Imports FilePurpose, FileStatus, IFile from ../models/file.model.
import { FilePurpose, FileStatus, IFile } from "../models/file.model";
// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";
// Imports NotFoundError from ../../../common/errors/NotFoundError.
import { NotFoundError } from "../../../common/errors/NotFoundError";

// Declares a type used to describe this service data.
export interface PurposeRule {
  // Declares the maxSizeBytes property with type or value number.
  maxSizeBytes: number;
  // Declares the allowedMimeTypes property with type or value string[].
  allowedMimeTypes: string[];
  // Declares the keyPrefix property with type or value string.
  keyPrefix: string;
  // Declares the privateOnly property with type or value boolean.
  privateOnly: boolean;
// Closes the current block.
}

// Makes this declaration available to other modules.
export const PURPOSE_RULES: Record<FilePurpose, PurposeRule> = {
  // Provides the next part of the surrounding operation.
  [FilePurpose.SERVICE_DOCUMENT]: {
    // Declares the maxSizeBytes property with type or value 10 * 1024 * 1024,.
    maxSizeBytes: 10 * 1024 * 1024,
    // Declares the allowedMimeTypes property with type or value ["application/pdf", "image/jpeg", "image/png"],.
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
    // Declares the keyPrefix property with type or value "service-requests/documents",.
    keyPrefix: "service-requests/documents",
    // Declares the privateOnly property with type or value true,.
    privateOnly: true,
  // Closes the current block.
  },
  // Provides the next part of the surrounding operation.
  [FilePurpose.PROFILE_IMAGE]: {
    // Declares the maxSizeBytes property with type or value 5 * 1024 * 1024,.
    maxSizeBytes: 5 * 1024 * 1024,
    // Declares the allowedMimeTypes property with type or value ["image/jpeg", "image/png", "image/webp"],.
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    // Declares the keyPrefix property with type or value "profiles",.
    keyPrefix: "profiles",
    // Declares the privateOnly property with type or value true,.
    privateOnly: true,
  // Closes the current block.
  },
  // Provides the next part of the surrounding operation.
  [FilePurpose.DOCUMENT]: {
    // Declares the maxSizeBytes property with type or value 10 * 1024 * 1024,.
    maxSizeBytes: 10 * 1024 * 1024,
    // Declares the allowedMimeTypes property with type or value [.
    allowedMimeTypes: [
      // Provides the next part of the surrounding operation.
      "application/pdf",
      // Provides the next part of the surrounding operation.
      "application/msword",
      // Provides the next part of the surrounding operation.
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      // Provides the next part of the surrounding operation.
      "image/jpeg",
      // Provides the next part of the surrounding operation.
      "image/png",
    // Provides the next part of the surrounding operation.
    ],
    // Declares the keyPrefix property with type or value "documents",.
    keyPrefix: "documents",
    // Declares the privateOnly property with type or value true,.
    privateOnly: true,
  // Closes the current block.
  },
  // Provides the next part of the surrounding operation.
  [FilePurpose.OTHER]: {
    // Declares the maxSizeBytes property with type or value 10 * 1024 * 1024,.
    maxSizeBytes: 10 * 1024 * 1024,
    // Declares the allowedMimeTypes property with type or value [],.
    allowedMimeTypes: [],
    // Declares the keyPrefix property with type or value "uploads",.
    keyPrefix: "uploads",
    // Declares the privateOnly property with type or value true,.
    privateOnly: true,
  // Closes the current block.
  },
// Closes the current block.
};

// Declares the service class that groups related application operations.
export class FileService {
  // Provides the next part of the surrounding operation.
  private fileRepo = new FileRepository();
  // Provides the next part of the surrounding operation.
  private storageService = new StorageService();

  // Creates the requested operation or resource.
  // Declares a function or method used by this service.
  async requestUploadUrl(input: {
    // Declares the fileName property with type or value string.
    fileName: string;
    // Declares the contentType property with type or value string.
    contentType: string;
    // Declares the size property with type or value number.
    size: number;
    // Declares the purpose property with type or value FilePurpose.
    purpose: FilePurpose;
    // Declares the ownerId property with type or value string.
    ownerId?: string;
    // Declares the entityId property with type or value string.
    entityId?: string;
  // Closes the current block.
  }): Promise<{
    // Declares the fileId property with type or value string.
    fileId: string;
    // Declares the uploadUrl property with type or value string.
    uploadUrl: string;
    // Declares the uploadToken property with type or value string.
    uploadToken: string;
    // Declares the storageKey property with type or value string.
    storageKey: string;
    // Declares the expiresIn property with type or value number.
    expiresIn: number;
  // Closes the current block.
  }> {
    // Provides the next part of the surrounding operation.
    const { fileName, contentType, size, purpose } = input;

    // Runs the following branch when !purpose || !PURPOSE_RULES[purpose] is true.
    if (!purpose || !PURPOSE_RULES[purpose]) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(`Invalid file purpose: ${purpose}`);
    // Closes the current block.
    }

    // Defines rule using the value on the right-hand side.
    const rule = PURPOSE_RULES[purpose];
    // Runs the following branch when rule.allowedMimeTypes.length > 0 && !rule.allowedMimeTypes.includes(contentType) is true.
    if (rule.allowedMimeTypes.length > 0 && !rule.allowedMimeTypes.includes(contentType)) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(
        // Provides the next part of the surrounding operation.
        `Invalid content type '${contentType}' for purpose '${purpose}'. Allowed types: ${rule.allowedMimeTypes.join(", ")}`,
      // Provides the next part of the surrounding operation.
      );
    // Closes the current block.
    }

    // Runs the following branch when size <= 0) throw new BadRequestError("File size must be greater than 0 bytes" is true.
    if (size <= 0) throw new BadRequestError("File size must be greater than 0 bytes");
    // Runs the following branch when size > rule.maxSizeBytes is true.
    if (size > rule.maxSizeBytes) {
      // Defines maxMb using the value on the right-hand side.
      const maxMb = rule.maxSizeBytes / (1024 * 1024);
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(`File size exceeds maximum allowed limit of ${maxMb} MB for ${purpose}`);
    // Closes the current block.
    }

    // Stores the result of fileName.split in parts.
    const parts = fileName.split(".");
    // Stores the result of parts.pop in rawExt.
    const rawExt = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
    // Stores the result of test in safeExt.
    const safeExt = rawExt && /^[a-z0-9]+$/.test(rawExt) ? rawExt : "bin";
    // Stores the result of crypto.randomUUID in storageKey.
    const storageKey = `${rule.keyPrefix}/${crypto.randomUUID()}.${safeExt}`;
    // Stores the result of crypto.randomUUID in uploadToken.
    const uploadToken = crypto.randomUUID();

    // Stores the result of this.fileRepo.create in fileRecord.
    const fileRecord = await this.fileRepo.create({
      // Declares the originalName property with type or value fileName,.
      originalName: fileName,
      // Provides the next part of the surrounding operation.
      storageKey,
      // Declares the mimeType property with type or value contentType,.
      mimeType: contentType,
      // Provides the next part of the surrounding operation.
      size,
      // Provides the next part of the surrounding operation.
      purpose,
      // Provides the next part of the surrounding operation.
      uploadToken,
      // Declares the status property with type or value FileStatus.PENDING,.
      status: FileStatus.PENDING,
      // Declares the owner property with type or value input.ownerId,.
      owner: input.ownerId,
      // Declares the entityId property with type or value input.entityId,.
      entityId: input.entityId,
      // Declares the isPrivate property with type or value rule.privateOnly,.
      isPrivate: rule.privateOnly,
    // Closes the current block.
    });

    // Stores the result of this.storageService.generateUploadUrl in uploadUrl.
    const uploadUrl = await this.storageService.generateUploadUrl(storageKey, contentType);

    // Returns { to the caller.
    return {
      // Declares the fileId property with type or value String(fileRecord._id),.
      fileId: String(fileRecord._id),
      // Provides the next part of the surrounding operation.
      uploadUrl,
      // Provides the next part of the surrounding operation.
      uploadToken,
      // Provides the next part of the surrounding operation.
      storageKey,
      // Declares the expiresIn property with type or value 3600,.
      expiresIn: 3600,
    // Closes the current block.
    };
  // Closes the current block.
  }

  // Completes the requested operation.
  // Declares a function or method used by this service.
  async completeUpload(fileId: string, uploadToken?: string, entityId?: string): Promise<{ file: IFile; url: string }> {
    // Stores the result of this.fileRepo.findById in file.
    const file = await this.fileRepo.findById(fileId);
    // Runs the following branch when !file) throw new NotFoundError("File record not found" is true.
    if (!file) throw new NotFoundError("File record not found");
    // Runs the following branch when file.status === FileStatus.DELETED) throw new BadRequestError("File record has been d is true.
    if (file.status === FileStatus.DELETED) throw new BadRequestError("File record has been deleted");
    // Runs the following branch when uploadToken && file.uploadToken !== uploadToken) throw new BadRequestError("Invalid f is true.
    if (uploadToken && file.uploadToken !== uploadToken) throw new BadRequestError("Invalid file upload completion token");

    // Runs the following branch when file.status === FileStatus.UPLOADED is true.
    if (file.status === FileStatus.UPLOADED) {
      // Stores the result of this.storageService.generateDownloadUrl in url.
      const url = await this.storageService.generateDownloadUrl(file.storageKey);
      // Returns { file, url } to the caller.
      return { file, url };
    // Closes the current block.
    }

    // Defines rule using the value on the right-hand side.
    const rule = PURPOSE_RULES[file.purpose];
    // Starts an operation whose errors are handled below.
    try {
      // Stores the result of this.storageService.headObject in head.
      const head = await this.storageService.headObject(file.storageKey);
      // Defines actualSize using the value on the right-hand side.
      const actualSize = head.contentLength || file.size;
      // Runs the following branch when rule && actualSize > rule.maxSizeBytes is true.
      if (rule && actualSize > rule.maxSizeBytes) {
        // Starts an operation whose errors are handled below.
        try {
          // Waits for storageService.deleteObject to finish before continuing.
          await this.storageService.deleteObject(file.storageKey);
        // Closes the current block.
        } catch (_) {}
        // Waits for fileRepo.updateStatus to finish before continuing.
        await this.fileRepo.updateStatus(fileId, FileStatus.FAILED);
        // Raises BadRequestError to report an invalid or failed operation.
        throw new BadRequestError(`Actual file size exceeds maximum allowed for ${file.purpose}`);
      // Closes the current block.
      }

      // Stores the result of this.fileRepo.updateStatus in updated.
      const updated = await this.fileRepo.updateStatus(fileId, FileStatus.UPLOADED, { actualSize, entityId });
      // Stores the result of this.storageService.generateDownloadUrl in url.
      const url = await this.storageService.generateDownloadUrl(file.storageKey);
      // Returns { file: updated || file, url } to the caller.
      return { file: updated || file, url };
    // Closes the current block.
    } catch (error: any) {
      // Runs the following branch when error instanceof BadRequestError is true.
      if (error instanceof BadRequestError) throw error;
      // Waits for fileRepo.updateStatus to finish before continuing.
      await this.fileRepo.updateStatus(fileId, FileStatus.FAILED);
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError(`File completion failed. Storage object not found or incomplete: ${error.message || "Object missing"}`);
    // Closes the current block.
    }
  // Closes the current block.
  }

  // Returns the requested value or record.
  // Declares a function or method used by this service.
  async getFileById(fileId: string): Promise<{ file: IFile; url: string }> {
    // Stores the result of this.fileRepo.findById in file.
    const file = await this.fileRepo.findById(fileId);
    // Runs the following branch when !file) throw new NotFoundError("File not found" is true.
    if (!file) throw new NotFoundError("File not found");
    // Stores the result of this.storageService.generateDownloadUrl in url.
    const url = await this.storageService.generateDownloadUrl(file.storageKey);
    // Returns { file, url } to the caller.
    return { file, url };
  // Closes the current block.
  }

  // Deletes the matching record.
  // Declares a function or method used by this service.
  async deleteFile(fileId: string): Promise<void> {
    // Stores the result of this.fileRepo.findById in file.
    const file = await this.fileRepo.findById(fileId);
    // Runs the following branch when !file) throw new NotFoundError("File not found" is true.
    if (!file) throw new NotFoundError("File not found");
    // Starts an operation whose errors are handled below.
    try {
      // Waits for storageService.deleteObject to finish before continuing.
      await this.storageService.deleteObject(file.storageKey);
    // Closes the current block.
    } catch (_) {}
    // Waits for fileRepo.delete to finish before continuing.
    await this.fileRepo.delete(fileId);
  // Closes the current block.
  }
// Closes the current block.
}
