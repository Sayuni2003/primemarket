import Listing from "../models/Listing.js";
import Interaction from "../models/Interaction.js";
import { recommendForUser } from "./recommendationScoring.js";

// Loads the data from MongoDB, then hands it to the pure scoring functions
export const getRecommendations = async (userId) => {
  // Only this user's interactions: this is what keeps every user's feed independent of everyone else's
  const interactions = await Interaction.find({ userId }).select("listingId type").lean();
  const interactedListingIds = [...new Set(interactions.map((item) => item.listingId.toString()))];

  const [interactedListings, candidates] = await Promise.all([
    // Interactions whose listing was deleted find nothing here, so they are ignored
    Listing.find({ _id: { $in: interactedListingIds } }).select("-__v").lean(),
    // Listings the user hasn't viewed, saved or contacted (every listing for a new user)
    Listing.find({ _id: { $nin: interactedListingIds } }).select("-__v").lean(),
  ]);

  return recommendForUser({ interactions, interactedListings, candidates });
};
