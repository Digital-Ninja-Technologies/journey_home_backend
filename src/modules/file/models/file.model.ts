import mongoose, { Schema, Document, Types } from "mongoose";

export enum FilePurpose {
  SERVICE_DOCUMENT = "SERVICE_DOCUMENT",
  PROFILE_IMAGE = "PROFILE_IMAGE",
  DOCUMENT = "DOCUMENT",
  OTHER = "OTHER",
}

export enum FileStatus {
  PENDING = "PENDING",
  UPLOADED = "UPLOADED",
  FAILED = "FAILED",
  DELETED = "DELETED",
}

export interface IFile extends Document {
  originalName: string;
  storageKey: string;
  mimeType: string;
  size: number;
  actualSize?: number;
  purpose: FilePurpose;
  status: FileStatus;
  uploadToken: string;
  owner?: Types.ObjectId;
  entityId?: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema = new Schema<IFile>(
  {
    originalName: { type: String, required: true, trim: true },
    storageKey: { type: String, required: true, unique: true, index: true },
    mimeType: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 1 },
    actualSize: { type: Number },
    purpose: {
      type: String,
      enum: Object.values(FilePurpose),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(FileStatus),
      default: FileStatus.PENDING,
      required: true,
      index: true,
    },
    uploadToken: { type: String, required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", index: true },
    entityId: { type: String, index: true },
    isPrivate: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

FileSchema.index({ status: 1, purpose: 1 });
FileSchema.index({ owner: 1, createdAt: -1 });

export const FileModel = mongoose.model<IFile>("File", FileSchema);
