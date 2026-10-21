import { Router } from "express";
import { authRequired, requireRole } from "../../../api/middlewares/auth";
import { validate } from "../../../common/validations/validate";
import { UserRole } from "../../auth/models/auth.model";
import { ServiceRequestController } from "../controllers/service-request.controller";
import {
  CompleteServiceDocumentUploadValidator,
  CreateServiceRequestValidator,
  RequestServiceDocumentUploadValidator,
  AdminRequestStatusValidator,
  VerifyServiceDocumentValidator,
} from "../validators/service-request.validator";

const router = Router();
const controller = new ServiceRequestController();

router.use(authRequired);

router.post("/", validate(CreateServiceRequestValidator), controller.create);
router.get("/", controller.listMine);
router.get("/admin", requireRole([UserRole.ADMIN]), controller.listAll);
router.get("/:id", controller.get);

router.post("/:id/documents/upload-url", validate(RequestServiceDocumentUploadValidator), controller.requestDocumentUpload);
router.post("/:id/documents/complete", validate(CompleteServiceDocumentUploadValidator), controller.completeDocumentUpload);
router.get("/:id/documents/:documentId/download-url", controller.getDocumentDownload);

router.patch("/:id/documents/:documentId/verify", requireRole([UserRole.ADMIN]), validate(VerifyServiceDocumentValidator), controller.verifyDocument);
router.patch("/:id/status", requireRole([UserRole.ADMIN]), validate(AdminRequestStatusValidator), controller.updateStatus);

export default router;
