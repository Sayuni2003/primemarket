import {
  getListingPoints,
  getListingTags,
  buildProfile,
  scoreListing,
  getDefaultOrder,
  rankForUser,
} from "../../services/recommendationScoring.js";
import { FOR_YOU_LIMIT } from "../../config/recommendation.js";
import { makeListing } from "../helpers/fixtures.js";

// Pure functions only care about _id, so readable string ids are fine here
const vehicle = (_id, title, location, make, fuelType, daysAgo) =>
  makeListing({ _id, title, category: "vehicle", location, attributes: { make, fuelType }, daysAgo });

// The worked example from the README
const aqua = vehicle("aqua", "Toyota Aqua", "Colombo", "toyota", "hybrid", 0);
const fit = vehicle("fit", "Honda Fit", "Colombo", "honda", "hybrid", 1);
const prius = vehicle("prius", "Toyota Prius", "Kandy", "toyota", "hybrid", 2);
const axio = vehicle("axio", "Toyota Axio", "Gampaha", "toyota", "hybrid", 3);
const wagonR = vehicle("wagonR", "Suzuki Wagon R", "Colombo", "suzuki", "hybrid", 4);
const vitz = vehicle("vitz", "Toyota Vitz", "Nugegoda", "toyota", "petrol", 5);
const vezel = vehicle("vezel", "Honda Vezel", "Negombo", "honda", "hybrid", 6);
const dio = vehicle("dio", "Honda Dio", "Dehiwala", "honda", "petrol", 7);
const apartment = makeListing({
  _id: "apartment", title: "Apartment", category: "property", location: "Colombo",
  attributes: { propertyType: "apartment", bedrooms: 2 }, daysAgo: 0,
});
const house = makeListing({
  _id: "house", title: "House", category: "property", location: "Kandy",
  attributes: { propertyType: "house", bedrooms: 3 }, daysAgo: 1,
});
const workedListings = [aqua, fit, prius, axio, wagonR, vitz, vezel, dio, apartment, house];

// Aqua: view + contact_seller (repeated views on purpose) = 6 points, Fit: view = 1 point
const workedInteractions = [
  { listingId: "aqua", type: "view" },
  { listingId: "aqua", type: "view" },
  { listingId: "aqua", type: "contact_seller" },
  { listingId: "fit", type: "view" },
];

describe("getListingPoints", () => {
  test("10 views + 1 contact on the same listing = 6, not 15", () => {
    const interactions = [
      ...Array.from({ length: 10 }, () => ({ listingId: "x", type: "view" })),
      { listingId: "x", type: "contact_seller" },
    ];
    expect(getListingPoints(interactions).get("x")).toBe(6);
  });

  test("all three actions on one listing give the maximum of 9", () => {
    const points = getListingPoints([
      { listingId: "x", type: "view" },
      { listingId: "x", type: "save" },
      { listingId: "x", type: "contact_seller" },
    ]);
    expect(points.get("x")).toBe(9);
  });
});

describe("getListingTags", () => {
  test("builds category, primary, secondary and location tags", () => {
    expect(getListingTags(aqua)).toEqual([
      { type: "category", tag: "category:vehicle", label: "Vehicles" },
      { type: "primary", tag: "vehicle:make:toyota", label: "Toyota" },
      { type: "secondary", tag: "vehicle:fuelType:hybrid", label: "Hybrid" },
      { type: "location", tag: "location:colombo", label: "Colombo" },
    ]);
  });

  test("a land listing (no bedrooms) gives 3 tags and doesn't crash", () => {
    const land = makeListing({
      _id: "land", title: "Land", category: "property", location: "Gampaha",
      attributes: { propertyType: "land", landPerches: 10 },
    });
    expect(getListingTags(land).map((t) => t.tag)).toEqual([
      "category:property",
      "property:propertyType:land",
      "location:gampaha",
    ]);
  });

  test("trims and lowercases values; numbers get a readable label", () => {
    const listing = makeListing({
      _id: "p", title: "House", category: "property", location: " Kandy ",
      attributes: { propertyType: " House ", bedrooms: 3 },
    });
    expect(getListingTags(listing)).toContainEqual(
      { type: "primary", tag: "property:propertyType:house", label: "House" }
    );
    expect(getListingTags(listing)).toContainEqual(
      { type: "secondary", tag: "property:bedrooms:3", label: "3 bedrooms" }
    );
    expect(getListingTags(listing)).toContainEqual(
      { type: "location", tag: "location:kandy", label: "Kandy" }
    );
  });
});

describe("worked example", () => {
  const profile = buildProfile([aqua, fit], getListingPoints(workedInteractions));

  test("buildProfile adds each listing's points to all of its tags", () => {
    expect(Object.fromEntries(profile)).toEqual({
      "category:vehicle": 7,
      "vehicle:make:toyota": 6,
      "vehicle:make:honda": 1,
      "vehicle:fuelType:hybrid": 7,
      "location:colombo": 7,
    });
  });

  test.each([
    ["Toyota Prius", prius, 26],
    ["Toyota Axio", axio, 26],
    ["Suzuki Wagon R", wagonR, 21],
    ["Toyota Vitz", vitz, 19],
    ["Honda Vezel", vezel, 16],
    ["Honda Dio", dio, 9],
    ["Apartment", apartment, 7],
    ["House", house, 0],
  ])("scoreListing: %s scores %i", (title, listing, expected) => {
    expect(scoreListing(listing, profile).score).toBe(expected);
  });

  test("the breakdown lists contributors, highest first", () => {
    expect(scoreListing(prius, profile).breakdown).toEqual([
      { tag: "vehicle:make:toyota", label: "Toyota", type: "primary", points: 12 },
      { tag: "category:vehicle", label: "Vehicles", type: "category", points: 7 },
      { tag: "vehicle:fuelType:hybrid", label: "Hybrid", type: "secondary", points: 7 },
    ]);
  });

  test("rankForUser gives the expected forYou and others", () => {
    const { isNewUser, forYou, others } = rankForUser(workedListings, workedInteractions);

    expect(isNewUser).toBe(false);
    expect(forYou.map((item) => [item.listing.title, item.score])).toEqual([
      ["Toyota Prius", 26], // ties (Prius/Axio) keep default order: Prius is newer
      ["Toyota Axio", 26],
      ["Suzuki Wagon R", 21],
      ["Toyota Vitz", 19],
      ["Honda Vezel", 16],
      ["Honda Dio", 9],
      ["Apartment", 7],
    ]);
    expect(forYou[0].reason).toBe("Because you showed interest in Toyota");
    expect(forYou.at(-1).reason).toBe("Because you've been looking in Colombo");

    // House scored 0, so it's in others; touched listings come last with their strongest action
    expect(others.map((item) => [item.listing.title, item.interacted])).toEqual([
      ["House", null],
      ["Toyota Aqua", "contact_seller"],
      ["Honda Fit", "view"],
    ]);
  });
});

describe("getDefaultOrder", () => {
  test("newest first within a category, then round-robin across categories", () => {
    const listings = [
      makeListing({ _id: "v-old", title: "v-old", category: "vehicle", location: "a", daysAgo: 5 }),
      makeListing({ _id: "v-new", title: "v-new", category: "vehicle", location: "a", daysAgo: 1 }),
      makeListing({ _id: "f1", title: "f1", category: "furniture", location: "a", daysAgo: 1 }),
      makeListing({ _id: "e1", title: "e1", category: "electronics", location: "a", daysAgo: 1 }),
      makeListing({ _id: "p1", title: "p1", category: "property", location: "a", daysAgo: 1 }),
      makeListing({ _id: "p2", title: "p2", category: "property", location: "a", daysAgo: 2 }),
    ];
    expect(getDefaultOrder(listings).map((l) => l._id)).toEqual(["v-new", "p1", "e1", "f1", "v-old", "p2"]);
  });

  test("equal createdAt falls back to _id descending", () => {
    const listings = ["a1", "a3", "a2"].map((_id) =>
      makeListing({ _id, title: _id, category: "vehicle", location: "a", daysAgo: 0 })
    );
    expect(getDefaultOrder(listings).map((l) => l._id)).toEqual(["a3", "a2", "a1"]);
  });
});

describe("rankForUser edge cases", () => {
  test("cold start: no interactions gives an empty forYou and the default order", () => {
    const result = rankForUser(workedListings, []);
    expect(result.isNewUser).toBe(true);
    expect(result.forYou).toEqual([]);
    expect(result.others.map((item) => item.listing)).toEqual(getDefaultOrder(workedListings));
    expect(result.others.every((item) => item.interacted === null)).toBe(true);
  });

  test("interactions that only point to deleted listings count as cold start", () => {
    const result = rankForUser(workedListings, [{ listingId: "deleted", type: "contact_seller" }]);
    expect(result.isNewUser).toBe(true);
    expect(result.forYou).toEqual([]);
  });

  test(`forYou holds at most ${FOR_YOU_LIMIT} listings`, () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      vehicle(`t${i}`, `Toyota ${i}`, "Kandy", "toyota", "petrol", i)
    );
    const { forYou, others } = rankForUser(many, [{ listingId: "t0", type: "view" }]);
    expect(forYou).toHaveLength(FOR_YOU_LIMIT);
    expect(others).toHaveLength(12 - FOR_YOU_LIMIT);
  });
});
