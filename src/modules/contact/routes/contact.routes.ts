import { Router } from "express";
import { authRequired, requireRole } from "../../../api/middlewares/auth";
import { validate } from "../../../common/validations/validate";
import { UserRole } from "../../auth/models/auth.model";
import { ContactController } from "../controllers/contact.controller";
import { CreateContactSubmissionValidator } from "../validators/contact.validator";
import { createRateLimiter } from "../../../api/middlewares/rateLimit";

const router = Router();
const controller = new ContactController();

const contactLimit = createRateLimiter(
  5,
  30 * 60 * 1000,
  "Too many contact submissions. Please try again later.",
);

router.post("/", contactLimit, validate(CreateContactSubmissionValidator), controller.create);

router.get(
  "/admin",
  authRequired,
  requireRole([UserRole.ADMIN]),
  controller.listAll,
);

router.get(
  "/admin/:id",
  authRequired,
  requireRole([UserRole.ADMIN]),
  controller.getById,
);

export default router;
