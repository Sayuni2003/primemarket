import { Router } from "express";
import { getListings, getListing } from "../controllers/listingController.js";

const router = Router();

router.get("/", getListings);
router.get("/:id", getListing);

export default router;
