import { Router } from "express";
import { authRequired, requireAdmin, requireRole } from "../../../api/middlewares/auth";
import { validate } from "../../../common/validations/validate";
import { UserRole } from "../../auth/models/auth.model";
import { PlanController } from "../controllers/plan.controller";
import {
  AdminStatusValidator,
  CreatePlanValidator,
} from "../validators/plan.validator";

const router = Router();
const controller = new PlanController();

router.use(authRequired);

router.post("/", validate(CreatePlanValidator), controller.create);

router.get("/", controller.listForOwner);
router.get("/dashboard", controller.dashboard);

router.get("/admin", requireAdmin, controller.listAll);

router.get("/:id", controller.getPLan);

router.patch(
  "/:id/status",
  requireRole([UserRole.ADMIN]),
  validate(AdminStatusValidator),
  controller.adminTransition,
);

export default router;
