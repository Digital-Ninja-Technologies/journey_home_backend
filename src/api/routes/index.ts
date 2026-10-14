import { Router } from "express";
import authRoutes from "../../modules/auth/routes/auth.routes";

const router = Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,

    message: "Journey Home Backend is running.",

    timestamp: new Date(),
  });
});

router.use("/auth", authRoutes);

export default router;
