import mongoose from "mongoose";
import User from "../models/User.js";

// Returns the seeded user for this id, or null if the id is malformed or unknown
const findUser = async (userId) => {
  if (!mongoose.isValidObjectId(userId)) return null;
  return User.findById(userId).select("name").lean();
};

// No auth: the client sends the selected seeded user's id in the X-User-Id header
export const requireUser = async (req, res, next) => {
  const user = await findUser(req.get("X-User-Id"));
  if (!user) {
    return res.status(401).json({ message: "Select a user first" });
  }

  req.user = user;
  next();
};
