import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import { users } from "./data/users.js";

// Upserts by _id, so re-running updates the seed data without touching anything else
const seedUsers = async () => {
  await User.bulkWrite(
    users.map((user) => ({
      replaceOne: { filter: { _id: user._id }, replacement: user, upsert: true },
    }))
  );
  console.log(`Seeded ${users.length} users`);
};

connectDB()
  .then(seedUsers)
  .catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
