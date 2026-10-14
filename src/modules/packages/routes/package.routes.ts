import { Router } from "express";
import { authRequired, requireRole } from "../../../api/middlewares/auth";
import { validate } from "../../../common/validations/validate";
import { UserRole } from "../../auth/models/auth.model";
import { PackageController } from "../controllers/package.controller";
import { CreatePackageValidator, UpdatePackageValidator } from "../validators/package.validator";

const router = Router();
const controller = new PackageController();

router.get("/", controller.listActive);
router.get("/admin", authRequired, requireRole([UserRole.ADMIN]), controller.listAll);
router.get("/:id", authRequired, controller.get);
router.post("/", authRequired, requireRole([UserRole.ADMIN]), validate(CreatePackageValidator), controller.create);
router.patch("/:id", authRequired, requireRole([UserRole.ADMIN]), validate(UpdatePackageValidator), controller.update);

export default router;
