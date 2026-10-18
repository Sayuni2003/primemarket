import { Router } from "express";
import { getUsers, getCurrentUser } from "../controllers/userController.js";
import { requireUser } from "../middleware/currentUser.js";

const router = Router();

router.get("/", getUsers);
router.get("/me", requireUser, getCurrentUser);

export default router;
