// Pure functions for the personalised feed: no database calls, so each one can be unit tested on its own.
// recommendationService.js loads the data from MongoDB and passes it in.
import {
  ACTION_WEIGHTS,
  CATEGORY_FEATURES,
  TAG_WEIGHTS,
  FOR_YOU_LIMIT,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
} from "../config/recommendation.js";

// Step 3 - points per touched listing.
// Each action type counts once per listing, so 10 views + 1 contact = 1 + 5 = 6 (not 15).
// Returns Map<listingId, points>; the most a listing can earn is 1 + 3 + 5 = 9.
export const getListingPoints = (interactions) => {
  // Group the distinct action types by listing, e.g. "66…01" → Set { "view", "contact_seller" }
  const typesByListing = new Map();
  for (const { listingId, type } of interactions) {
    const id = String(listingId);
    if (!typesByListing.has(id)) typesByListing.set(id, new Set());
    typesByListing.get(id).add(type); // a Set ignores repeats
  }

  const points = new Map();
  for (const [id, types] of typesByListing) {
    let total = 0;
    for (const type of types) total += ACTION_WEIGHTS[type];
    points.set(id, total);
  }
  return points;
};

// Lowercase and trim so "Toyota ", "toyota" and "TOYOTA" all build the same tag
const normalise = (value) => String(value).trim().toLowerCase();

// "wagon r" → "Wagon R", for labels shown in reasons
const titleCase = (text) => text.replace(/\b\w/g, (letter) => letter.toUpperCase());

// A number alone reads badly in a reason ("interest in 3"), so numbers get their key: "3 bedrooms"
const attributeLabel = (key, value) =>
  typeof value === "number" ? `${value} ${key}` : titleCase(normalise(value));

// Step 4 - turn a listing into tags. Two listings are "similar" when they share tags.
// Returns [{ type, tag, label }], e.g. { type: "primary", tag: "vehicle:make:toyota", label: "Toyota" }
export const getListingTags = (listing) => {
  const { category } = listing;
  const tags = [
    { type: "category", tag: `category:${category}`, label: CATEGORY_LABELS[category] ?? titleCase(category) },
  ];

  const features = CATEGORY_FEATURES[category] ?? {};
  for (const type of ["primary", "secondary"]) {
    const key = features[type];
    const attribute = listing.attributes?.find((a) => a.key === key);
    // Some listings don't have every attribute (e.g. land has no bedrooms): skip that tag
    if (!key || attribute == null || attribute.value == null || normalise(attribute.value) === "") continue;

    // Prefixed with the category so electronics:type:laptop can never collide with furniture:type:sofa
    tags.push({
      type,
      tag: `${category}:${key}:${normalise(attribute.value)}`,
      label: attributeLabel(key, attribute.value),
    });
  }

  if (listing.location) {
    const location = normalise(listing.location);
    tags.push({ type: "location", tag: `location:${location}`, label: titleCase(location) });
  }

  return tags;
};

// Step 5 - the user's interest profile: Map<tag, points>.
// Each touched listing adds its points to every one of its tags, e.g. a Toyota Aqua worth 6 points
// adds 6 to category:vehicle, vehicle:make:toyota, vehicle:fuelType:hybrid and location:colombo.
// It is rebuilt on every request (never stored), so it can't get out of sync with the interactions.
export const buildProfile = (touchedListings, listingPoints) => {
  const profile = new Map();
  for (const listing of touchedListings) {
    const points = listingPoints.get(String(listing._id)) ?? 0;
    for (const { tag } of getListingTags(listing)) {
      profile.set(tag, (profile.get(tag) ?? 0) + points);
    }
  }
  return profile;
};

// Step 6 - score one listing against the profile.
// score = sum over the listing's tags of profile[tag] × TAG_WEIGHTS[tag type].
// The primary attribute is weighted ×2 because it's the most specific signal:
// "Toyota" says much more about what the user wants than "vehicle" does.
export const scoreListing = (listing, profile) => {
  const breakdown = [];
  for (const { type, tag, label } of getListingTags(listing)) {
    const points = (profile.get(tag) ?? 0) * TAG_WEIGHTS[type];
    if (points > 0) breakdown.push({ tag, label, type, points });
  }

  // Highest contributor first. sort() is stable, so ties keep tag order (category, primary, secondary, location)
  breakdown.sort((a, b) => b.points - a.points);
  const score = breakdown.reduce((sum, item) => sum + item.points, 0);
  return { score, breakdown };
};

// Newest first; equal createdAt falls back to _id (desc) so the order is identical on every request.
// ObjectId hex strings all have the same length, so comparing them as strings is safe.
const newestFirst = (a, b) =>
  new Date(b.createdAt) - new Date(a.createdAt) || String(b._id).localeCompare(String(a._id));

// Step 7 - default feed order, used for cold start and as the tie-breaker everywhere else.
// It uses only listing data (never other users' activity), so users stay isolated.
// Categories are interleaved round-robin: 1st vehicle, 1st property, 1st electronics, 1st furniture, 2nd vehicle, …
export const getDefaultOrder = (listings) => {
  // One newest-first queue per category (the Listing model's enum guarantees every category is in CATEGORY_ORDER)
  const queues = CATEGORY_ORDER.map((category) =>
    listings.filter((listing) => listing.category === category).sort(newestFirst)
  );

  const ordered = [];
  const longest = Math.max(0, ...queues.map((queue) => queue.length));
  for (let round = 0; round < longest; round++) {
    for (const queue of queues) {
      if (round < queue.length) ordered.push(queue[round]);
    }
  }
  return ordered;
};

// The strongest action per listing ("contact_seller" > "save" > "view"), for badges like "Contacted"
const getStrongestActions = (interactions) => {
  const strongest = new Map();
  for (const { listingId, type } of interactions) {
    const id = String(listingId);
    const current = strongest.get(id);
    if (!current || ACTION_WEIGHTS[type] > ACTION_WEIGHTS[current]) strongest.set(id, type);
  }
  return strongest;
};

// The reason shown on a "For you" card comes from its biggest contributor
const getReason = ({ type, label }) => {
  if (type === "location") return `Because you've been looking in ${label}`;
  if (type === "category") return `Because you've been browsing ${label}`;
  return `Because you showed interest in ${label}`; // primary or secondary attribute
};

// Step 8 - rank every listing for one user.
// Returns { isNewUser, forYou: [{ listing, score, reason, breakdown }], others: [{ listing, interacted }] }
export const rankForUser = (listings, interactions) => {
  const defaultOrder = getDefaultOrder(listings);
  const listingPoints = getListingPoints(interactions);
  const isTouched = (listing) => listingPoints.has(String(listing._id));

  // Interactions pointing at deleted listings simply don't match anything here
  const touched = defaultOrder.filter(isTouched);
  const untouched = defaultOrder.filter((listing) => !isTouched(listing));

  // Cold start: nothing to personalise from, so show the default feed
  if (touched.length === 0) {
    return {
      isNewUser: true,
      forYou: [],
      others: defaultOrder.map((listing) => ({ listing, interacted: null })),
    };
  }

  const profile = buildProfile(touched, listingPoints);
  const scored = untouched.map((listing) => ({ listing, ...scoreListing(listing, profile) }));
  // untouched is already in default order and sort() is stable, so equal scores keep that order
  scored.sort((a, b) => b.score - a.score);

  // Highest scores come first, so the listings with score > 0 are at the front
  const forYouCount = Math.min(FOR_YOU_LIMIT, scored.filter((item) => item.score > 0).length);

  const forYou = scored.slice(0, forYouCount).map(({ listing, score, breakdown }) => ({
    listing,
    score,
    reason: getReason(breakdown[0]),
    breakdown,
  }));

  // Already-interacted listings are left out of forYou (recommending something you already contacted
  // adds nothing) and shown at the end of others, badged with their strongest action
  const strongest = getStrongestActions(interactions);
  const others = [
    ...scored.slice(forYouCount).map(({ listing }) => ({ listing, interacted: null })),
    ...touched.map((listing) => ({ listing, interacted: strongest.get(String(listing._id)) })),
  ];

  return { isNewUser: false, forYou, others };
};
