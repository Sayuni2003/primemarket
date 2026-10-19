import { Router } from "express";
import { getUsers } from "../controllers/userController.js";
import { getSavedListings } from "../controllers/saveController.js";
import { requireUser } from "../middleware/currentUser.js";

const router = Router();

router.get("/", getUsers);
router.get("/me/saved", requireUser, getSavedListings);

export default router;
