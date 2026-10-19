import Listing from "../models/Listing.js";
import Interaction from "../models/Interaction.js";
import { rankForUser } from "./recommendationScoring.js";

// Loads the data from MongoDB, then hands it to the pure ranking functions
export const getRecommendations = async (userId) => {
  const [listings, interactions] = await Promise.all([
    Listing.find().select("-__v").lean(),
    // Only this user's interactions: this is what keeps every user's feed independent of everyone else's
    Interaction.find({ userId }).select("listingId type").lean(),
  ]);

  return rankForUser(listings, interactions);
};
