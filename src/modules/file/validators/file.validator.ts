import { z } from "zod";
import { FilePurpose } from "../models/file.model";

export const RequestUploadUrlValidator = z.object({
  fileName: z.string().min(1, "fileName is required").trim(),
  contentType: z.string().min(1, "contentType is required").trim(),
  size: z.number().positive("size must be greater than 0"),
  purpose: z.nativeEnum(FilePurpose, {
    errorMap: () => ({
      message: `purpose must be one of: ${Object.values(FilePurpose).join(", ")}`,
    }),
  }),
});

export const CompleteUploadValidator = z.object({
  uploadToken: z.string().optional(),
});
