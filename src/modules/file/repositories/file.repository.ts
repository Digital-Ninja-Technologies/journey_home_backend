// import { FileModel, IFile, FileStatus, FilePurpose } from "../models/file.model";

// export class FileRepository {
//   async create(data: {
//     originalName: string;
//     storageKey: string;
//     mimeType: string;
//     size: number;
//     purpose: FilePurpose;
//     uploadToken: string;
//     status?: FileStatus;
//     entityId?: string;
//   }): Promise<IFile> {
//     return FileModel.create(data);
//   }

//   async findById(id: string): Promise<IFile | null> {
//     return FileModel.findById(id).exec();
//   }

//   async findByStorageKey(storageKey: string): Promise<IFile | null> {
//     return FileModel.findOne({ storageKey }).exec();
//   }

//   async updateStatus(
//     id: string,
//     status: FileStatus,
//     extraFields?: { actualSize?: number; entityId?: string }
//   ): Promise<IFile | null> {
//     return FileModel.findByIdAndUpdate(
//       id,
//       { status, ...extraFields },
//       { new: true }
//     ).exec();
//   }

//   async updateEntityId(id: string, entityId: string): Promise<IFile | null> {
//     return FileModel.findByIdAndUpdate(
//       id,
//       { entityId },
//       { new: true }
//     ).exec();
//   }

//   async delete(id: string): Promise<IFile | null> {
//     return FileModel.findByIdAndUpdate(
//       id,
//       { status: FileStatus.DELETED },
//       { new: true }
//     ).exec();
//   }
// }
