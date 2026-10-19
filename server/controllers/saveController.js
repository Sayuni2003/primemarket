import mongoose from "mongoose";
import Interaction from "../models/Interaction.js";
import { withImageUrl } from "./listingController.js";

// DELETE /api/listings/:id/save - idempotent, unsaving twice is fine
export const unsaveListing = async (req, res) => {
  const listingId = req.params.id;
  if (!mongoose.isValidObjectId(listingId)) {
    return res.status(404).json({ message: "Listing not found" });
  }

  await Interaction.deleteOne({ userId: req.user._id, listingId, type: "save" });
  res.json({ listingId, saved: false });
};

// GET /api/users/me/saved - the user's saved listings, most recently saved first
export const getSavedListings = async (req, res) => {
  const saves = await Interaction.find({ userId: req.user._id, type: "save" })
    .sort({ createdAt: -1 })
    .populate({ path: "listingId", select: "-__v" })
    .lean();

  // A listing removed by a re-seed leaves a dangling save; skip it
  const listings = saves.map((save) => save.listingId).filter(Boolean);
  res.json(await Promise.all(listings.map(withImageUrl)));
};
