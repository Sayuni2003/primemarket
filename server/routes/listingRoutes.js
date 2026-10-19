import { Router } from "express";
import { getListings, getListing } from "../controllers/listingController.js";
import { saveListing, unsaveListing } from "../controllers/saveController.js";
import { requireUser } from "../middleware/currentUser.js";

const router = Router();

router.get("/", getListings);
router.get("/:id", getListing);
router.post("/:id/save", requireUser, saveListing);
router.delete("/:id/save", requireUser, unsaveListing);

export default router;
