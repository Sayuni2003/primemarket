import { findUser } from "../middleware/currentUser.js";

// POST /api/login - body { userId }; confirms the picked user exists before the client stores the id
export const login = async (req, res) => {
  const user = await findUser(req.body?.userId);
  if (!user) {
    return res.status(401).json({ message: "Unknown user" });
  }
  res.json(user);
};

// POST /api/logout - nothing is stored server-side; the client forgets the stored user id
export const logout = (req, res) => {
  res.status(204).end();
};
