import { Router } from "express";
import { authRequired, requireAdmin } from "../../api/middlewares/auth";
import { AdminController } from "./admin.controller";
const router = Router();
const controller = new AdminController();
router.use(authRequired, requireAdmin);
router.get("/overview", controller.overview);
router.get("/users", controller.users);
export default router;
