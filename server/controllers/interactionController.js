import mongoose from "mongoose";
import Interaction, { INTERACTION_TYPES } from "../models/Interaction.js";
import User from "../models/User.js";
import Listing from "../models/Listing.js";

// POST /api/interactions - body { userId, listingId, type }
export const recordInteraction = async (req, res) => {
  const { userId, listingId, type } = req.body ?? {};

  // Check the shape of the input before touching the database
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(listingId)) {
    return res.status(400).json({ message: "userId and listingId must be valid ids" });
  }
  if (!INTERACTION_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of: ${INTERACTION_TYPES.join(", ")}` });
  }

  const [userFound, listingFound] = await Promise.all([
    User.exists({ _id: userId }),
    Listing.exists({ _id: listingId }),
  ]);
  if (!userFound) {
    return res.status(404).json({ message: "User not found" });
  }
  if (!listingFound) {
    return res.status(404).json({ message: "Listing not found" });
  }

  const interaction = { userId, listingId, type };

  if (type === "save") {
    // A save is unique per user + listing. The upsert inserts it only if it doesn't exist yet,
    // so saving twice never hits the unique index and never creates a second document.
    // $setOnInsert means an existing save is left untouched (it keeps its original createdAt).
    const result = await Interaction.findOneAndUpdate(
      interaction,
      { $setOnInsert: interaction },
      { upsert: true, returnDocument: "after", includeResultMetadata: true }
    );
    // updatedExisting is true when the save was already there
    const status = result.lastErrorObject.updatedExisting ? 200 : 201;
    return res.status(status).json(result.value);
  }

  // Views and contacts are an activity log: every click is kept as its own document.
  // Repeats don't inflate the ranking, because scoring counts each action type once per listing.
  const created = await Interaction.create(interaction);
  res.status(201).json(created);
};
