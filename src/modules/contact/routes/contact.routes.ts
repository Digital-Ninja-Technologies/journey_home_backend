import { Router } from "express";
import { authRequired, requireRole } from "../../../api/middlewares/auth";
import { validate } from "../../../common/validations/validate";
import { UserRole } from "../../auth/models/auth.model";
import { ContactController } from "../controllers/contact.controller";
import { CreateContactSubmissionValidator } from "../validators/contact.validator";

const router = Router();
const controller = new ContactController();

router.post("/", validate(CreateContactSubmissionValidator), controller.create);
router.get("/admin", authRequired, requireRole([UserRole.ADMIN]), controller.listAll);
router.get("/admin/:id", authRequired, requireRole([UserRole.ADMIN]), controller.getById);

export default router;
