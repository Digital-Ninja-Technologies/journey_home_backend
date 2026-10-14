// import mongoose, { Schema, Document } from "mongoose";

// export enum FilePurpose {
//   PROJECT_IMAGE = "PROJECT_IMAGE",
//   CV = "CV",
//   PROFILE_IMAGE = "PROFILE_IMAGE",
//   DOCUMENT = "DOCUMENT",
//   OTHER = "OTHER",
// }

// export enum FileStatus {
//   PENDING = "PENDING",
//   UPLOADED = "UPLOADED",
//   FAILED = "FAILED",
//   DELETED = "DELETED",
// }

// export interface IFile extends Document {
//   originalName: string;
//   storageKey: string;
//   mimeType: string;
//   size: number;
//   actualSize?: number;
//   purpose: FilePurpose;
//   status: FileStatus;
//   uploadToken: string;
//   entityId?: string;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const FileSchema = new Schema<IFile>(
//   {
//     originalName: { type: String, required: true, trim: true },
//     storageKey: { type: String, required: true, unique: true, index: true },
//     mimeType: { type: String, required: true, trim: true },
//     size: { type: Number, required: true },
//     actualSize: { type: Number, required: false },
//     purpose: {
//       type: String,
//       enum: Object.values(FilePurpose),
//       required: true,
//       index: true,
//     },
//     status: {
//       type: String,
//       enum: Object.values(FileStatus),
//       default: FileStatus.PENDING,
//       required: true,
//       index: true,
//     },
//     uploadToken: { type: String, required: true },
//     entityId: { type: String, required: false, index: true },
//   },
//   { timestamps: true }
// );

// FileSchema.index({ status: 1, purpose: 1 });

// export const FileModel = mongoose.model<IFile>("File", FileSchema);
