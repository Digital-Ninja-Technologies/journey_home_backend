// import { Router } from "express";
// import { FileController } from "../controllers/file.controller";
// import { validate } from "../../../common/validations/validate";
// import { authRequired, requireSuperAdmin } from "../../../api/middlewares/auth";
// import {
//   RequestUploadUrlValidator,
//   CompleteUploadValidator,
// } from "../validators/file.validator";

// const router = Router();
// const controller = new FileController();

// router.post(
//   "/upload-url",
//   validate(RequestUploadUrlValidator),
//   controller.requestUploadUrl
// );

// router.post(
//   "/:id/complete",
//   validate(CompleteUploadValidator),
//   controller.completeUpload
// );

// router.get("/:id", controller.getFile);

// router.delete("/:id", authRequired, requireSuperAdmin, controller.deleteFile);

// export default router;
