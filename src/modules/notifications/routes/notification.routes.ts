import { Router } from "express";
import { authRequired } from "../../../api/middlewares/auth";
import { NotificationController } from "../controllers/notification.controller";

const router = Router();
const controller = new NotificationController();

router.get("/", authRequired, controller.listMine);
router.patch("/:id/read", authRequired, controller.markRead);
router.delete("/:id", authRequired, controller.deleteMine);

export default router;
