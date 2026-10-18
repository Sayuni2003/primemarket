import mongoose from "mongoose";

export const INTERACTION_TYPES = ["save", "view", "contact_seller"];

const interactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
    type: { type: String, required: true, enum: INTERACTION_TYPES },
  },
  { timestamps: true }
);

// Views and contacts can repeat, but a user can save a listing only once
interactionSchema.index(
  { userId: 1, listingId: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: "save" } }
);
interactionSchema.index({ userId: 1, createdAt: -1 });
interactionSchema.index({ listingId: 1, type: 1 });

export default mongoose.model("Interaction", interactionSchema);
