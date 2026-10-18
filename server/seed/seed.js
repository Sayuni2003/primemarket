import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Listing from "../models/Listing.js";
import { users } from "./data/users.js";
import { listings } from "./data/listings.js";

// Upserts by _id, so re-running updates the seed data without touching anything else
const upsertAll = async (Model, docs) => {
  await Model.bulkWrite(
    docs.map((doc) => ({
      replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
    }))
  );
  console.log(`Seeded ${docs.length} ${Model.collection.name}`);
};

const seed = async () => {
  await upsertAll(User, users);
  await upsertAll(Listing, listings);
};

connectDB()
  .then(seed)
  .catch((err) => {
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
