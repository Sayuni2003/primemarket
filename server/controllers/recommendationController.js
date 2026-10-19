import mongoose from "mongoose";
import User from "../models/User.js";
import { getRecommendations } from "../services/recommendationService.js";
import { withImageUrl } from "./listingController.js";

// GET /api/recommendations?userId=
export const getRecommendationsForUser = async (req, res) => {
  const { userId } = req.query;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "userId must be a valid id" });
  }
  if (!(await User.exists({ _id: userId }))) {
    return res.status(404).json({ message: "User not found" });
  }

  const { isNewUser, forYou, others } = await getRecommendations(userId);

  // withImageUrl swaps each listing's S3 imageKey for a presigned imageUrl (null when there's no image)
  const withImage = async (item) => ({ ...item, listing: await withImageUrl(item.listing) });

  res.json({
    userId,
    isNewUser,
    forYou: await Promise.all(forYou.map(withImage)),
    others: await Promise.all(others.map(withImage)),
  });
};
