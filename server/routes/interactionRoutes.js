import { Router } from "express";
import { recordInteraction } from "../controllers/interactionController.js";

const router = Router();

// userId comes in the request body, validated by the controller
router.post("/", recordInteraction);

export default router;
