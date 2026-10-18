import mongoose from "mongoose";

// No auth: users are seeded and identified by their _id
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
