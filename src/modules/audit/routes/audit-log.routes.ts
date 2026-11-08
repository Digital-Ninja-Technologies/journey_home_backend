import { Router } from "express";
import { authRequired, requireAdmin } from "../../../api/middlewares/auth";
import { AuditLogController } from "../controllers/audit-log.controller";

const router = Router();
const controller = new AuditLogController();

router.use(authRequired, requireAdmin);

router.get("/", controller.getAll);
router.get("/:id", controller.getOne);
router.delete("/:id", controller.deleteLog);

export default router;
