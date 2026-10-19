import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import User from "../../models/User.js";
import Listing from "../../models/Listing.js";
import Interaction from "../../models/Interaction.js";
import { connect, clear, disconnect } from "../helpers/db.js";
import { makeListing } from "../helpers/fixtures.js";

let user;
let listing;

beforeAll(connect);
afterAll(disconnect);

beforeEach(async () => {
  await clear();
  user = await User.create({ name: "Test User" });
  listing = await Listing.create(
    makeListing({ title: "Toyota Aqua", category: "vehicle", location: "Colombo", attributes: { make: "toyota" } })
  );
});

const post = (body) => request(app).post("/api/interactions").send(body);
const validBody = (type) => ({ userId: String(user._id), listingId: String(listing._id), type });

describe("POST /api/interactions - validation", () => {
  test("400 when userId or listingId isn't a valid id", async () => {
    expect((await post({ ...validBody("view"), userId: "abc" })).status).toBe(400);
    expect((await post({ ...validBody("view"), listingId: "abc" })).status).toBe(400);
  });

  test("400 when type isn't view, save or contact_seller", async () => {
    expect((await post(validBody("like"))).status).toBe(400);
  });

  test("404 when the user or listing doesn't exist", async () => {
    const unknownId = String(new mongoose.Types.ObjectId());
    expect((await post({ ...validBody("view"), userId: unknownId })).status).toBe(404);
    expect((await post({ ...validBody("view"), listingId: unknownId })).status).toBe(404);
  });
});

describe("POST /api/interactions - storing", () => {
  test("every view and contact is stored as its own document", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await post(validBody("view"));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ userId: String(user._id), listingId: String(listing._id), type: "view" });
    }
    await post(validBody("contact_seller"));

    expect(await Interaction.countDocuments({ type: "view" })).toBe(3);
    expect(await Interaction.countDocuments({ type: "contact_seller" })).toBe(1);
  });

  test("saving twice returns 201 then 200 and keeps a single document", async () => {
    const first = await post(validBody("save"));
    const second = await post(validBody("save"));

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body._id).toBe(first.body._id);
    expect(await Interaction.countDocuments({ type: "save" })).toBe(1);
  });
});
