import { Router } from "express";
import { recordInteraction } from "../controllers/interactionController.js";
import { requireUser } from "../middleware/currentUser.js";

const router = Router();

router.post("/", requireUser, recordInteraction);

export default router;
