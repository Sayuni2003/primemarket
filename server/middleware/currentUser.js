import mongoose from "mongoose";
import User from "../models/User.js";

// No auth: the client sends the selected seeded user's id in the X-User-Id header
export const requireUser = async (req, res, next) => {
  const userId = req.get("X-User-Id");
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(401).json({ message: "Select a user first" });
  }

  const user = await User.findById(userId).select("name").lean();
  if (!user) {
    return res.status(401).json({ message: "Unknown user" });
  }

  req.user = user;
  next();
};
