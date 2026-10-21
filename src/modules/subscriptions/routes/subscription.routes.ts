import { Router } from "express";
import { authRequired } from "../../../api/middlewares/auth";
import { SubscriptionController } from "../controllers/subscription.controller";
const router = Router(); const controller = new SubscriptionController();
router.use(authRequired);
router.get("/", controller.list);
router.get("/:id", controller.get);
export default router;
