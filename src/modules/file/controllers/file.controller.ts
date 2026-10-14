// import { Request, Response, NextFunction } from "express";
// import { FileService } from "../services/file.service";
// import { successResponse } from "../../../common/response/success-response";

// export class FileController {
//   private fileService: FileService;

//   constructor() {
//     this.fileService = new FileService();
//   }

//   requestUploadUrl = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const result = await this.fileService.requestUploadUrl(req.body);
//       successResponse(
//         res,
//         "Presigned upload URL generated successfully",
//         result,
//         201
//       );
//     } catch (error) {
//       next(error);
//     }
//   };

//   completeUpload = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const id = req.params.id as string;
//       const { uploadToken } = req.body || {};
//       const result = await this.fileService.completeUpload(id, uploadToken);
//       successResponse(res, "File upload verified and completed", {
//         file: result.file,
//         url: result.url,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   getFile = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const id = req.params.id as string;
//       const result = await this.fileService.getFileById(id);
//       successResponse(res, "File retrieved successfully", {
//         file: result.file,
//         url: result.url,
//       });
//     } catch (error) {
//       next(error);
//     }
//   };

//   deleteFile = async (
//     req: Request,
//     res: Response,
//     next: NextFunction
//   ): Promise<void> => {
//     try {
//       const id = req.params.id as string;
//       await this.fileService.deleteFile(id);
//       successResponse(res, "File deleted successfully");
//     } catch (error) {
//       next(error);
//     }
//   };
// }
