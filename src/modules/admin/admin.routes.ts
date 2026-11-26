import { Router } from "express";
import { authRequired, requireAdmin } from "../../api/middlewares/auth";
import { AdminController } from "./admin.controller";
import { createRateLimiter } from "../../api/middlewares/rateLimit";

const router = Router();
const controller = new AdminController();

const reminderTriggerLimit = createRateLimiter(
  3,
  15 * 60 * 1000,
  "Too many manual reminder trigger requests. Please wait before retrying.",
);

router.use(authRequired, requireAdmin);
router.get("/overview", controller.overview);
router.get("/users", controller.users);
router.post("/reminders/trigger", reminderTriggerLimit, controller.triggerReminders);
export default router;
