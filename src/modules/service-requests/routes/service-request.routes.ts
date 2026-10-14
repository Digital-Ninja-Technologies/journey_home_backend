import { Router } from "express";
import { authRequired, requireRole } from "../../../api/middlewares/auth";
import { validate } from "../../../common/validations/validate";
import { UserRole } from "../../auth/models/auth.model";
import { ServiceRequestController } from "../controllers/service-request.controller";
import {
  CompleteServiceDocumentUploadValidator,
  CreateServiceRequestValidator,
  RequestMoreInfoValidator,
  RequestServiceDocumentUploadValidator,
  ReviewServiceRequestValidator,
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

router.post("/:id/under-review", requireRole([UserRole.ADMIN]), controller.markUnderReview);
router.patch("/:id/documents/:documentId/verify", requireRole([UserRole.ADMIN]), validate(VerifyServiceDocumentValidator), controller.verifyDocument);
router.post("/:id/docs-verified", requireRole([UserRole.ADMIN]), controller.markDocsVerified);
router.post("/:id/approve", requireRole([UserRole.ADMIN]), controller.approve);
router.post("/:id/reject", requireRole([UserRole.ADMIN]), validate(ReviewServiceRequestValidator), controller.reject);
router.post("/:id/request-more-info", requireRole([UserRole.ADMIN]), validate(RequestMoreInfoValidator), controller.requestMoreInfo);

export default router;
