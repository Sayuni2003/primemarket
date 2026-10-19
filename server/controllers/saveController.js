import mongoose from "mongoose";
import Interaction from "../models/Interaction.js";
import { withImageUrl, listingExists } from "./listingController.js";

// POST /api/listings/:id/save - idempotent, so a double click still leaves one save
export const saveListing = async (req, res) => {
  const listingId = req.params.id;
  if (!(await listingExists(listingId))) {
    return res.status(404).json({ message: "Listing not found" });
  }

  const save = { userId: req.user._id, listingId, type: "save" };
  try {
    // $setOnInsert keeps the original createdAt when the listing is already saved
    await Interaction.updateOne(save, { $setOnInsert: save }, { upsert: true });
  } catch (err) {
    // Two concurrent upserts can race; the unique index rejects the second, which is still "saved"
    if (err.code !== 11000) throw err;
  }
  res.json({ listingId, saved: true });
};

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
