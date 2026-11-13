import { Router } from "express";
import { authRequired, requireAdmin } from "../../../api/middlewares/auth";
import { NotificationController } from "../controllers/notification.controller";

const router = Router();
const controller = new NotificationController();

router.get("/", authRequired, controller.listMine);
router.get("/admin", authRequired, requireAdmin, controller.listAdmin);
router.patch("/:id/read", authRequired, controller.markRead);
router.delete("/:id", authRequired, controller.deleteMine);

export default router;
