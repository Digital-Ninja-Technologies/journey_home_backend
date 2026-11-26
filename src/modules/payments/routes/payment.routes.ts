import { Router } from "express";
import { authRequired, requireAdmin } from "../../../api/middlewares/auth";
import { PaymentController } from "../controllers/payment.controller";
import { createRateLimiter } from "../../../api/middlewares/rateLimit";

const router = Router();
const controller = new PaymentController();

const paymentInitLimit = createRateLimiter(
  15,
  15 * 60 * 1000,
  "Too many payment initialization attempts. Please try again later.",
);

const paymentVerifyLimit = createRateLimiter(
  30,
  15 * 60 * 1000,
  "Too many payment verification attempts. Please try again later.",
);

router.post("/webhooks/paystack", controller.webhook);
router.get("/webhooks/status", authRequired, requireAdmin, controller.webhookStatus);
router.post(
  "/plans/:planId/initialize-initial",
  authRequired,
  paymentInitLimit,
  controller.initializeInitial,
);
router.post(
  "/verify/:reference",
  authRequired,
  paymentVerifyLimit,
  controller.verify,
);
router.get("/", authRequired, controller.listMine);
router.get("/admin", authRequired, requireAdmin, controller.listAll);
router.get("/:id", authRequired, controller.getMine);

export default router;
