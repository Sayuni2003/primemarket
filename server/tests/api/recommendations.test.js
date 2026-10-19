import request from "supertest";
import mongoose from "mongoose";
import app from "../../app.js";
import User from "../../models/User.js";
import Listing from "../../models/Listing.js";
import { connect, clear, disconnect } from "../helpers/db.js";
import { makeListing } from "../helpers/fixtures.js";

// 8 fixture listings across all four categories; daysAgo fixes the newest-first order
const fixtures = [
  makeListing({ title: "Toyota Aqua", category: "vehicle", location: "Colombo", attributes: { make: "toyota", fuelType: "hybrid" }, daysAgo: 0 }),
  makeListing({ title: "Toyota Prius", category: "vehicle", location: "Kandy", attributes: { make: "toyota", fuelType: "hybrid" }, daysAgo: 1 }),
  makeListing({ title: "Honda Fit", category: "vehicle", location: "Colombo", attributes: { make: "honda", fuelType: "hybrid" }, daysAgo: 2 }),
  makeListing({ title: "Apartment Colombo", category: "property", location: "Colombo", attributes: { propertyType: "apartment", bedrooms: 2 }, daysAgo: 0 }),
  makeListing({ title: "Apartment Dehiwala", category: "property", location: "Dehiwala", attributes: { propertyType: "apartment", bedrooms: 2 }, daysAgo: 1 }),
  makeListing({ title: "House Kandy", category: "property", location: "Kandy", attributes: { propertyType: "house", bedrooms: 3 }, daysAgo: 2 }),
  makeListing({ title: "iPhone", category: "electronics", location: "Colombo", attributes: { brand: "apple", type: "phone" }, daysAgo: 0 }),
  makeListing({ title: "Teak Sofa", category: "furniture", location: "Kandy", attributes: { type: "sofa", material: "teak" }, daysAgo: 0 }),
];

let userA;
let userB;
let byTitle; // title → saved listing document

beforeAll(connect);
afterAll(disconnect);

beforeEach(async () => {
  await clear();
  [userA, userB] = await User.create([{ name: "User A" }, { name: "User B" }]);
  const listings = await Listing.insertMany(fixtures);
  byTitle = Object.fromEntries(listings.map((listing) => [listing.title, listing]));
});

// Interactions go through the real POST endpoint, so Part C is exercised too
const record = (user, title, type) =>
  request(app)
    .post("/api/interactions")
    .send({ userId: String(user._id), listingId: String(byTitle[title]._id), type })
    .expect((res) => expect([200, 201]).toContain(res.status));

const getFeed = (user) => request(app).get("/api/recommendations").query({ userId: String(user._id) }).expect(200);

describe("GET /api/recommendations - validation", () => {
  test("400 when userId is missing or invalid", async () => {
    await request(app).get("/api/recommendations").expect(400);
    await request(app).get("/api/recommendations").query({ userId: "abc" }).expect(400);
  });

  test("404 when the user doesn't exist", async () => {
    await request(app).get("/api/recommendations").query({ userId: String(new mongoose.Types.ObjectId()) }).expect(404);
  });
});

describe("cold start", () => {
  test("a user with no interactions gets the default round-robin feed", async () => {
    const { body } = await getFeed(userA);

    expect(body.userId).toBe(String(userA._id));
    expect(body.isNewUser).toBe(true);
    expect(body.forYou).toEqual([]);
    // Newest per category, interleaved vehicle → property → electronics → furniture
    expect(body.others.map((item) => item.listing.title)).toEqual([
      "Toyota Aqua", "Apartment Colombo", "iPhone", "Teak Sofa",
      "Toyota Prius", "Apartment Dehiwala",
      "Honda Fit", "House Kandy",
    ]);
    expect(body.others.every((item) => item.interacted === null)).toBe(true);
    // No S3 in tests, so every listing gets imageUrl: null
    expect(body.others.every((item) => item.listing.imageUrl === null)).toBe(true);
  });
});

describe("user-specific recommendations and isolation", () => {
  test("each user's feed follows only their own interactions", async () => {
    await record(userB, "Apartment Colombo", "save");
    const bBefore = (await getFeed(userB)).body;

    await record(userA, "Toyota Aqua", "contact_seller");
    const a = (await getFeed(userA)).body;
    const bAfter = (await getFeed(userB)).body;

    expect(a.isNewUser).toBe(false);
    expect(a.forYou[0].listing.category).toBe("vehicle");
    expect(bAfter.forYou[0].listing.category).toBe("property");

    // A's activity changed nothing in B's feed
    expect(bAfter).toEqual(bBefore);
  });
});

describe("repeated interactions", () => {
  test("10 views of a listing score the same as 1 view", async () => {
    for (let i = 0; i < 10; i++) await record(userA, "Toyota Aqua", "view");
    await record(userB, "Toyota Aqua", "view");

    const a = (await getFeed(userA)).body;
    const b = (await getFeed(userB)).body;

    expect(a.forYou.length).toBeGreaterThan(0);
    expect(a.forYou.map((item) => [item.listing.title, item.score])).toEqual(
      b.forYou.map((item) => [item.listing.title, item.score])
    );
  });

  test("a listing the user interacted with never appears in their own forYou", async () => {
    await record(userA, "Toyota Aqua", "view");
    await record(userA, "Toyota Aqua", "save");

    const { body } = await getFeed(userA);
    const aquaId = String(byTitle["Toyota Aqua"]._id);

    expect(body.forYou.some((item) => item.listing._id === aquaId)).toBe(false);
    // It's shown at the end of others, badged with the strongest action
    expect(body.others.at(-1)).toMatchObject({ listing: { _id: aquaId }, interacted: "save" });
  });
});
