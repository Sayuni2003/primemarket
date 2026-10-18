import Interaction from "../models/Interaction.js";
import { listingExists } from "./listingController.js";

// Saves have their own endpoints (POST/DELETE /api/listings/:id/save); add "contact_seller" here when its button exists
const RECORDABLE_TYPES = ["view"];

// A refresh or a double-fired effect shouldn't count as a second view
const VIEW_DEDUPE_MS = 10 * 60 * 1000;

// POST /api/interactions - body { listingId, type }
export const recordInteraction = async (req, res) => {
  const { listingId, type } = req.body ?? {};

  if (!RECORDABLE_TYPES.includes(type)) {
    return res.status(400).json({ message: `type must be one of: ${RECORDABLE_TYPES.join(", ")}` });
  }
  if (!(await listingExists(listingId))) {
    return res.status(404).json({ message: "Listing not found" });
  }

  const interaction = { userId: req.user._id, listingId, type };

  if (type === "view") {
    const recent = await Interaction.exists({
      ...interaction,
      createdAt: { $gte: new Date(Date.now() - VIEW_DEDUPE_MS) },
    });
    if (recent) {
      return res.json({ ...interaction, recorded: false });
    }
  }

  await Interaction.create(interaction);
  res.status(201).json({ ...interaction, recorded: true });
};
