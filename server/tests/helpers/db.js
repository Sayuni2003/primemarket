import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Each test file gets its own throwaway in-memory MongoDB, so tests never touch the real database
let server;

export const connect = async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  // Build the models' indexes (including the unique-save index) before any test runs
  await mongoose.connection.syncIndexes();
};

// Empty every collection between tests (indexes are kept)
export const clear = async () => {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

export const disconnect = async () => {
  await mongoose.disconnect();
  await server.stop();
};
