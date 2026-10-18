import { Router } from "express";
import { getUsers, getCurrentUser } from "../controllers/userController.js";
import { getSavedListings } from "../controllers/saveController.js";
import { requireUser } from "../middleware/currentUser.js";

const router = Router();

router.get("/", getUsers);
router.get("/me", requireUser, getCurrentUser);
router.get("/me/saved", requireUser, getSavedListings);

export default router;
