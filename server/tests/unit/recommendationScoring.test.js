import {
  getInteractionPoints,
  buildProfile,
  scoreCandidate,
  rankCandidates,
  getDefaultOrder,
  recommendForUser,
} from "../../services/recommendationScoring.js";
import { RECOMMENDATION_LIMIT } from "../../config/recommendation.js";
import { makeListing } from "../helpers/fixtures.js";

// Pure functions only care about _id, so readable string ids are fine here
const property = (_id, location, propertyType, bedrooms, daysAgo = 0) =>
  makeListing({ _id, title: _id, category: "property", location, attributes: { propertyType, bedrooms }, daysAgo });
const vehicle = (_id, location, make, fuelType, daysAgo = 0) =>
  makeListing({ _id, title: _id, category: "vehicle", location, attributes: { make, fuelType }, daysAgo });

// Plain objects are easier to compare than Maps
const profileAsObject = (profile) => ({
  categories: Object.fromEntries(profile.categories),
  locations: Object.fromEntries(profile.locations),
  attributes: Object.fromEntries(profile.attributes),
});

describe("getInteractionPoints", () => {
  test("5 views of the same listing = 3 points (views are capped at 3)", () => {
    const views = Array.from({ length: 5 }, () => ({ listingId: "x", type: "view" }));
    expect(getInteractionPoints(views).get("x")).toBe(3);
  });

  test("each type is capped separately: 5 views + 1 save + 4 contacts = 3 + 3 + 10", () => {
    const interactions = [
      ...Array.from({ length: 5 }, () => ({ listingId: "x", type: "view" })),
      { listingId: "x", type: "save" },
      ...Array.from({ length: 4 }, () => ({ listingId: "x", type: "contact_seller" })),
    ];
    expect(getInteractionPoints(interactions).get("x")).toBe(16);
  });

  test("points are kept per listing", () => {
    const points = getInteractionPoints([
      { listingId: "a", type: "view" },
      { listingId: "b", type: "save" },
    ]);
    expect(Object.fromEntries(points)).toEqual({ a: 1, b: 3 });
  });
});

describe("buildProfile", () => {
  test("keys are trimmed and lowercased", () => {
    const listing = vehicle("v", " Kandy ", " Toyota ", "HYBRID");
    const profile = buildProfile([listing], new Map([["v", 1]]));
    expect(profileAsObject(profile)).toEqual({
      categories: { vehicle: 1 },
      locations: { kandy: 1 },
      attributes: { "vehicle:make:toyota": 1, "vehicle:fueltype:hybrid": 1 },
    });
  });

  test("a land listing (no bedrooms) is skipped for that attribute instead of crashing", () => {
    const land = makeListing({
      _id: "land", title: "Land", category: "property", location: "Gampaha",
      attributes: { propertyType: "land", landPerches: 10 },
    });
    const profile = buildProfile([land], new Map([["land", 3]]));
    expect(Object.fromEntries(profile.attributes)).toEqual({ "property:propertytype:land": 3 });
    expect(scoreCandidate(land, profile).score).toBe(3 + 3 + 3);
  });

  test("attributes that aren't configured for the category are ignored", () => {
    const listing = makeListing({
      _id: "v", title: "v", category: "vehicle", location: "Colombo",
      attributes: { make: "honda", transmission: "auto" },
    });
    const profile = buildProfile([listing], new Map([["v", 1]]));
    expect(Object.fromEntries(profile.attributes)).toEqual({ "vehicle:make:honda": 1 });
  });
});

// The worked example in the README (Recommendation logic, section 6): both of its tables are checked here
describe("README section 6: worked example", () => {
  const apartmentColombo = property("apartment-colombo", "Colombo", "apartment", 2);
  const apartmentColombo2 = property("apartment-colombo-2", "Colombo", "apartment", 2);
  const toyotaKandy = vehicle("toyota-kandy", "Kandy", "Toyota", "hybrid");
  const interactions = [
    { listingId: "apartment-colombo", type: "view" }, // 1 point
    { listingId: "apartment-colombo-2", type: "save" }, // 3 points
    { listingId: "toyota-kandy", type: "view" }, // 1 point
  ];
  const profile = buildProfile(
    [apartmentColombo, apartmentColombo2, toyotaKandy],
    getInteractionPoints(interactions)
  );

  const apartmentDehiwala = property("apartment-dehiwala", "Dehiwala", "apartment", 2);
  const houseKandy = property("house-kandy", "Kandy", "house", 4);
  const toyotaColombo = vehicle("toyota-colombo", "Colombo", "Toyota", "hybrid");

  test("profile table: category, location and attribute points", () => {
    expect(profileAsObject(profile)).toEqual({
      categories: { property: 4, vehicle: 1 },
      locations: { colombo: 4, kandy: 1 },
      attributes: {
        "property:propertytype:apartment": 4,
        "property:bedrooms:2": 4,
        "vehicle:make:toyota": 1,
        "vehicle:fueltype:hybrid": 1,
      },
    });
  });

  // Named fields so the title can use $name and $expected (positional %i would pick up the listing object)
  test.each([
    { name: "Apartment in Dehiwala", listing: apartmentDehiwala, expected: 12 },
    { name: "House in Kandy", listing: houseKandy, expected: 5 },
    { name: "Toyota hybrid in Colombo", listing: toyotaColombo, expected: 7 },
  ])("candidate table: $name scores $expected", ({ listing, expected }) => {
    expect(scoreCandidate(listing, profile).score).toBe(expected);
  });

  test("candidate table: ranked 12, 7, 5", () => {
    const ranked = rankCandidates([houseKandy, toyotaColombo, apartmentDehiwala], profile);
    expect(ranked.map((item) => [item.listing._id, item.score])).toEqual([
      ["apartment-dehiwala", 12],
      ["toyota-colombo", 7],
      ["house-kandy", 5],
    ]);
  });

  test("every match gets a reason", () => {
    expect(scoreCandidate(apartmentDehiwala, profile).reasons).toEqual([
      "Matches preferred category: property",
      "Matches preferred propertyType: apartment",
      "Matches preferred bedrooms: 2",
    ]);
    expect(scoreCandidate(toyotaColombo, profile).reasons).toEqual([
      "Matches preferred category: vehicle",
      "Matches preferred location: Colombo",
      "Matches preferred make: Toyota",
      "Matches preferred fuelType: hybrid",
    ]);
  });
});

describe("rankCandidates", () => {
  test("equal scores fall back to _id ascending", () => {
    const profile = buildProfile([vehicle("seen", "Kandy", "toyota", "petrol")], new Map([["seen", 1]]));
    const ranked = rankCandidates(
      ["c", "a", "b"].map((_id) => vehicle(_id, "Kandy", "toyota", "petrol")),
      profile
    );
    expect(ranked.map((item) => item.listing._id)).toEqual(["a", "b", "c"]);
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

describe("recommendForUser", () => {
  const ids = (items) => items.map((item) => item.listing._id);

  test("cold start: no interactions gives the full default feed in others", () => {
    const listings = [vehicle("v", "Kandy", "toyota", "petrol", 1), property("p", "Colombo", "house", 3, 0)];
    const result = recommendForUser({ interactions: [], interactedListings: [], candidates: listings });

    expect(result.isNewUser).toBe(true);
    expect(result.message).toEqual(expect.any(String));
    expect(result.recommendations).toEqual([]);
    expect(ids(result.others)).toEqual(["v", "p"]);
  });

  test("interactions that only point to deleted listings count as cold start", () => {
    const listings = [vehicle("v", "Kandy", "toyota", "petrol")];
    const result = recommendForUser({
      interactions: [{ listingId: "deleted", type: "contact_seller" }],
      interactedListings: [],
      candidates: listings,
    });
    expect(result.isNewUser).toBe(true);
    expect(result.recommendations).toEqual([]);
  });

  test(`at most ${RECOMMENDATION_LIMIT} recommendations; the rest follow in default order, interacted last`, () => {
    // 12 identical Toyotas, so every candidate scores the same and _id decides the ranking
    const toyotas = Array.from({ length: 12 }, (_, i) =>
      vehicle(`t${String(i).padStart(2, "0")}`, "Kandy", "toyota", "petrol", i)
    );
    const [seen, ...candidates] = toyotas;
    const result = recommendForUser({
      interactions: [{ listingId: seen._id, type: "view" }],
      interactedListings: [seen],
      candidates,
    });

    expect(result.isNewUser).toBe(false);
    expect(result.message).toBeNull();
    expect(ids(result.recommendations)).toEqual(["t01", "t02", "t03", "t04", "t05", "t06", "t07", "t08"]);
    expect(ids(result.others)).toEqual(["t09", "t10", "t11", "t00"]);
  });

  test("a score of 0 isn't recommended: nothing matches, so others holds every listing", () => {
    const seen = vehicle("seen", "Colombo", "toyota", "hybrid");
    const sofa = makeListing({
      _id: "sofa", title: "sofa", category: "furniture", location: "Kandy", attributes: { type: "sofa" },
    });
    const result = recommendForUser({
      interactions: [{ listingId: "seen", type: "save" }],
      interactedListings: [seen],
      candidates: [sofa],
    });

    expect(result.recommendations).toEqual([]);
    expect(result.message).toEqual(expect.any(String));
    expect(ids(result.others)).toEqual(["sofa", "seen"]);
  });

  test("no candidates left: empty recommendations with a message", () => {
    const seen = vehicle("seen", "Colombo", "toyota", "hybrid");
    const result = recommendForUser({
      interactions: [{ listingId: "seen", type: "view" }],
      interactedListings: [seen],
      candidates: [],
    });

    expect(result.recommendations).toEqual([]);
    expect(result.message).toEqual(expect.any(String));
    expect(ids(result.others)).toEqual(["seen"]);
  });
});
