import { Router } from "express";
import { authRequired, requireRole } from "../../../api/middlewares/auth";
import { UserRole } from "../../auth/models/auth.model";
import { BillingController } from "../controllers/billing.controller";

const router = Router();
const controller = new BillingController();

router.use(authRequired, requireRole([UserRole.ADMIN]));
router.get("/policy", controller.policy);
router.post("/run-due", controller.runDue);

export default router;
