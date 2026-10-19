import mongoose from "mongoose";
import Listing, { LISTING_CATEGORIES } from "../models/Listing.js";
import { getImageUrl } from "../services/s3.js";

// Swap the stored S3 key for a short-lived URL the browser can load.
// A failure only costs that listing its image (imageUrl: null), never the whole response
export const withImageUrl = async ({ imageKey, ...listing }) => {
  try {
    return { ...listing, imageUrl: await getImageUrl(imageKey) };
  } catch (err) {
    console.error(`Could not sign image for listing ${listing._id}: ${err.message}`);
    return { ...listing, imageUrl: null };
  }
};

// GET /api/listings?category=&location=&minPrice=&maxPrice=&q=
export const getListings = async (req, res) => {
  const { category, location, minPrice, maxPrice, q } = req.query;
  const filter = {};

  if (category) {
    if (!LISTING_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `category must be one of: ${LISTING_CATEGORIES.join(", ")}` });
    }
    filter.category = category;
  }

  if (location) filter.location = String(location);

  if (minPrice || maxPrice) {
    const min = minPrice ? Number(minPrice) : 0;
    const max = maxPrice ? Number(maxPrice) : Infinity;
    if (Number.isNaN(min) || Number.isNaN(max)) {
      return res.status(400).json({ message: "minPrice and maxPrice must be numbers" });
    }
    filter.price = { $gte: min, $lte: max };
  }

  if (q) filter.$text = { $search: String(q) };

  const listings = await Listing.find(filter).select("-__v").sort({ createdAt: -1, _id: 1 }).lean();
  res.json(await Promise.all(listings.map(withImageUrl)));
};

// GET /api/listings/:id
export const getListing = async (req, res) => {
  const { id } = req.params;
  const listing = mongoose.isValidObjectId(id)
    ? await Listing.findById(id).select("-__v").lean()
    : null;

  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  res.json(await withImageUrl(listing));
};
