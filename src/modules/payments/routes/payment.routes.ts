import { Router } from "express";
import { authRequired } from "../../../api/middlewares/auth";
import { PaymentController } from "../controllers/payment.controller";

const router = Router();
const controller = new PaymentController();

router.post("/webhooks/paystack", controller.webhook);
router.post("/plans/:planId/initialize-initial", authRequired, controller.initializeInitial);
router.post("/verify/:reference", authRequired, controller.verify);
router.get("/", authRequired, controller.listMine);
router.get("/:id", authRequired, controller.getMine);

export default router;
