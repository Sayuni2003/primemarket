import User from "../models/User.js";

// GET /api/users - the seeded users shown in the "continue as" picker
export const getUsers = async (req, res) => {
  const users = await User.find().select("name").sort({ name: 1 }).lean();
  res.json(users);
};
