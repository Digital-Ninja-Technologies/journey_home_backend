import { Router } from "express";
import authRoutes from "../../modules/auth/routes/auth.routes";
import packageRoutes from "../../modules/packages/routes/package.routes";
import planRoutes from "../../modules/plans/routes/plan.routes";
import paymentRoutes from "../../modules/payments/routes/payment.routes";
import notificationRoutes from "../../modules/notifications/routes/notification.routes";
import serviceRequestRoutes from "../../modules/service-requests/routes/service-request.routes";
import subscriptionRoutes from "../../modules/subscriptions/routes/subscription.routes";
import adminRoutes from "../../modules/admin/admin.routes";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,

    message: "Journey Home Backend is running.",

    timestamp: new Date(),
  });
});

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/packages", packageRoutes);
router.use("/plans", planRoutes);
router.use("/payments", paymentRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/notifications", notificationRoutes);
router.use("/service-requests", serviceRequestRoutes);

export default router;
