// import crypto from "crypto";
// import { FileRepository } from "../repositories/file.repository";
// import { StorageService } from "./storage.service";
// import { FilePurpose, FileStatus, IFile } from "../models/file.model";
// import { BadRequestError } from "../../../common/errors/BadRequestError";
// import { NotFoundError } from "../../../common/errors/NotFoundError";

// export interface PurposeRule {
//   maxSizeBytes: number;
//   allowedMimeTypes: string[];
//   keyPrefix: string;
// }

// export const PURPOSE_RULES: Record<FilePurpose, PurposeRule> = {
//   [FilePurpose.PROJECT_IMAGE]: {
//     maxSizeBytes: 5 * 1024 * 1024,
//     allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
//     keyPrefix: "projects",
//   },
//   [FilePurpose.CV]: {
//     maxSizeBytes: 10 * 1024 * 1024, 
//     allowedMimeTypes: [
//       "application/pdf",
//       "application/msword",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//     ],
//     keyPrefix: "applications/cv",
//   },
//   [FilePurpose.PROFILE_IMAGE]: {
//     maxSizeBytes: 5 * 1024 * 1024,
//     allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
//     keyPrefix: "profiles",
//   },
//   [FilePurpose.DOCUMENT]: {
//     maxSizeBytes: 10 * 1024 * 1024, 
//     allowedMimeTypes: [
//       "application/pdf",
//       "application/msword",
//       "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
//       "image/jpeg",
//       "image/png",
//     ],
//     keyPrefix: "documents",
//   },
//   [FilePurpose.OTHER]: {
//     maxSizeBytes: 10 * 1024 * 1024, 
//     allowedMimeTypes: [],
//     keyPrefix: "uploads",
//   },
// };

// export class FileService {
//   private fileRepo: FileRepository;
//   private storageService: StorageService;

//   constructor() {
//     this.fileRepo = new FileRepository();
//     this.storageService = new StorageService();
//   }

//   // Validates file purpose, content-type, size and creates a PENDING file record with presigned PUT url
//   async requestUploadUrl(input: {
//     fileName: string;
//     contentType: string;
//     size: number;
//     purpose: FilePurpose;
//   }): Promise<{
//     fileId: string;
//     uploadUrl: string;
//     uploadToken: string;
//     storageKey: string;
//     expiresIn: number;
//   }> {
//     const { fileName, contentType, size, purpose } = input;

//     if (!purpose || !PURPOSE_RULES[purpose]) {
//       throw new BadRequestError(`Invalid file purpose: ${purpose}`);
//     }

//     const rule = PURPOSE_RULES[purpose];

//     // Validate MIME type
//     if (
//       rule.allowedMimeTypes.length > 0 &&
//       !rule.allowedMimeTypes.includes(contentType)
//     ) {
//       throw new BadRequestError(
//         `Invalid content type '${contentType}' for purpose '${purpose}'. Allowed types: ${rule.allowedMimeTypes.join(
//           ", "
//         )}`
//       );
//     }

//     // Validate declared size
//     if (size <= 0) {
//       throw new BadRequestError("File size must be greater than 0 bytes");
//     }

//     if (size > rule.maxSizeBytes) {
//       const maxMb = rule.maxSizeBytes / (1024 * 1024);
//       throw new BadRequestError(
//         `File size (${(size / (1024 * 1024)).toFixed(
//           2
//         )} MB) exceeds maximum allowed limit of ${maxMb} MB for ${purpose}`
//       );
//     }

//     // Generate extension and key
//     const parts = fileName.split(".");
//     const rawExt = parts.length > 1 ? parts.pop()?.toLowerCase() : "";
//     const safeExt = rawExt && /^[a-z0-9]+$/.test(rawExt) ? rawExt : "bin";
//     const uuid = crypto.randomUUID();
//     const storageKey = `${rule.keyPrefix}/${uuid}.${safeExt}`;

//     // Generate completion upload token
//     const uploadToken = crypto.randomUUID();

//     // Create DB record
//     const fileRecord = await this.fileRepo.create({
//       originalName: fileName,
//       storageKey,
//       mimeType: contentType,
//       size,
//       purpose,
//       uploadToken,
//       status: FileStatus.PENDING,
//     });

//     // Generate presigned PUT URL
//     const uploadUrl = await this.storageService.generateUploadUrl(
//       storageKey,
//       contentType
//     );

//     return {
//       fileId: String(fileRecord._id),
//       uploadUrl,
//       uploadToken,
//       storageKey,
//       expiresIn: 3600,
//     };
//   }

//   // Verifies uploaded object in Tigris object storage and marks file status as UPLOADED
//   async completeUpload(
//     fileId: string,
//     uploadToken?: string
//   ): Promise<{ file: IFile; url: string }> {
//     const file = await this.fileRepo.findById(fileId);
//     if (!file) {
//       throw new NotFoundError("File record not found");
//     }

//     if (file.status === FileStatus.DELETED) {
//       throw new BadRequestError("File record has been deleted");
//     }

//     // Verify token if provided
//     if (uploadToken && file.uploadToken !== uploadToken) {
//       throw new BadRequestError("Invalid file upload completion token");
//     }

//     if (file.status === FileStatus.UPLOADED) {
//       const url = await this.storageService.generateDownloadUrl(file.storageKey);
//       return { file, url };
//     }

//     const rule = PURPOSE_RULES[file.purpose];

//     // Verify actual object existence in storage via HeadObject
//     try {
//       const head = await this.storageService.headObject(file.storageKey);
//       const actualSize = head.contentLength || file.size;

//       // Verify size limit
//       if (rule && actualSize > rule.maxSizeBytes) {
//         // Attempt cleanup from Tigris
//         try {
//           await this.storageService.deleteObject(file.storageKey);
//         } catch (_) {}

//         await this.fileRepo.updateStatus(fileId, FileStatus.FAILED);
//         throw new BadRequestError(
//           `Actual file size exceeds maximum allowed for ${file.purpose}`
//         );
//       }

//       // Mark as UPLOADED
//       const updated = await this.fileRepo.updateStatus(
//         fileId,
//         FileStatus.UPLOADED,
//         { actualSize }
//       );

//       const url = await this.storageService.generateDownloadUrl(
//         file.storageKey
//       );
//       return { file: updated || file, url };
//     } catch (error: any) {
//       if (error instanceof BadRequestError) {
//         throw error;
//       }
//       await this.fileRepo.updateStatus(fileId, FileStatus.FAILED);
//       throw new BadRequestError(
//         `File completion failed. Storage object not found or incomplete: ${
//           error.message || "Object missing"
//         }`
//       );
//     }
//   }

//   // Resolves a file ID, storage key, or URL into a presigned GET URL
//   async resolveFileUrl(fileIdOrKeyOrUrl: string): Promise<string> {
//     if (!fileIdOrKeyOrUrl) return "";

//     let file: IFile | null = null;

//     //Try finding by MongoDB File ID (24-char hex string)
//     if (/^[0-9a-fA-F]{24}$/.test(fileIdOrKeyOrUrl)) {
//       file = await this.fileRepo.findById(fileIdOrKeyOrUrl);
//     }

//     // Try finding by storage key if not an HTTP(S) URL
//     if (
//       !file &&
//       !fileIdOrKeyOrUrl.startsWith("http://") &&
//       !fileIdOrKeyOrUrl.startsWith("https://")
//     ) {
//       file = await this.fileRepo.findByStorageKey(fileIdOrKeyOrUrl);
//     }

//     // If it's a URL, check if it's a Tigris URL and extract the storage key
//     if (
//       !file &&
//       (fileIdOrKeyOrUrl.startsWith("http://") ||
//         fileIdOrKeyOrUrl.startsWith("https://"))
//     ) {
//       try {
//         const parsedUrl = new URL(fileIdOrKeyOrUrl);
//         const storageKey = decodeURIComponent(
//           parsedUrl.pathname.replace(/^\/+/, "")
//         );

//         if (storageKey) {
//           file = await this.fileRepo.findByStorageKey(storageKey);

//           // If no DB record exists but pathname looks like a storage key (e.g. contains '/'),
//           // generate a presigned download URL directly for the extracted key
//           if (!file && storageKey.includes("/")) {
//             return this.storageService.generateDownloadUrl(storageKey);
//           }
//         }
//       } catch {
//       }
//     }

//     // If File record was found, generate a fresh presigned GET URL
//     if (file) {
//       return this.storageService.generateDownloadUrl(file.storageKey);
//     }

//     // If key provided directly
//     if (
//       !fileIdOrKeyOrUrl.startsWith("http://") &&
//       !fileIdOrKeyOrUrl.startsWith("https://") &&
//       fileIdOrKeyOrUrl.includes("/")
//     ) {
//       return this.storageService.generateDownloadUrl(fileIdOrKeyOrUrl);
//     }

//     // 6. Return as-is if it's an external third-party URL
//     return fileIdOrKeyOrUrl;
//   }

//   //Returns a file document by ID
//   async getFileById(fileId: string): Promise<{ file: IFile; url: string }> {
//     const file = await this.fileRepo.findById(fileId);
//     if (!file) {
//       throw new NotFoundError("File not found");
//     }
//     const url = await this.storageService.generateDownloadUrl(file.storageKey);
//     return { file, url };
//   }

//   // Deletes a file from storage and marks as DELETED in DB
//   async deleteFile(fileId: string): Promise<void> {
//     const file = await this.fileRepo.findById(fileId);
//     if (!file) {
//       throw new NotFoundError("File not found");
//     }

//     try {
//       await this.storageService.deleteObject(file.storageKey);
//     } catch (_) {}

//     await this.fileRepo.delete(fileId);
//   }
// }
