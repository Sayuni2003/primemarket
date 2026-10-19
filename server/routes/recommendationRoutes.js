import { Router } from "express";
import { getRecommendationsForUser } from "../controllers/recommendationController.js";

const router = Router();

router.get("/", getRecommendationsForUser);

export default router;
