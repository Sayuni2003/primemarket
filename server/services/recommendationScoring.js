// Pure functions for the personalised feed: no database calls, so each one can be unit tested on its own.
// recommendationService.js loads the data from MongoDB and passes it in.
import {
  INTERACTION_WEIGHTS,
  INTERACTION_CAPS,
  MATCHING_ATTRIBUTES,
  RECOMMENDATION_LIMIT,
  DEFAULT_FEED_CATEGORY_ORDER,
} from "../config/recommendation.js";

// Lowercase and trim so "Toyota ", "toyota" and "TOYOTA" all build the same key
const normalise = (value) => String(value).trim().toLowerCase();

// Effective points per interacted listing: Σ over types of min(count, cap) × weight.
// 5 views of one listing = min(5, 3) × 1 = 3 points, not 5.
// Returns Map<listingId, points>
export const getInteractionPoints = (interactions) => {
  // Count each type per listing, e.g. "66…01" → { view: 5, contact_seller: 1 }
  const counts = new Map();
  for (const { listingId, type } of interactions) {
    const id = String(listingId);
    const byType = counts.get(id) ?? {};
    byType[type] = (byType[type] ?? 0) + 1;
    counts.set(id, byType);
  }

  const points = new Map();
  for (const [id, byType] of counts) {
    let total = 0;
    for (const [type, count] of Object.entries(byType)) {
      total += Math.min(count, INTERACTION_CAPS[type]) * INTERACTION_WEIGHTS[type];
    }
    points.set(id, total);
  }
  return points;
};

// The listing's configured attributes, each with its profile key, e.g.
// { key: "make", value: "Toyota", profileKey: "vehicle:make:toyota" }.
// Attributes the listing doesn't have (land has no bedrooms) are skipped
const getMatchingAttributes = ({ category, attributes = [] }) =>
  (MATCHING_ATTRIBUTES[category] ?? []).flatMap((key) => {
    const value = attributes.find((attribute) => attribute.key === key)?.value;
    if (value == null || normalise(value) === "") return [];
    return [{ key, value, profileKey: [category, key, value].map(normalise).join(":") }];
  });

const addPoints = (map, key, points) => map.set(key, (map.get(key) ?? 0) + points);

// The user's preference profile: every interacted listing adds its points to its category,
// its location and each of its matching attributes.
// It is rebuilt on every request (never stored), so it can't get out of sync with the interactions.
export const buildProfile = (interactedListings, interactionPoints) => {
  const profile = { categories: new Map(), locations: new Map(), attributes: new Map() };
  for (const listing of interactedListings) {
    const points = interactionPoints.get(String(listing._id)) ?? 0;
    addPoints(profile.categories, normalise(listing.category), points);
    addPoints(profile.locations, normalise(listing.location), points);
    for (const { profileKey } of getMatchingAttributes(listing)) {
      addPoints(profile.attributes, profileKey, points);
    }
  }
  return profile;
};

// score = category points + location points + points of each matching attribute.
// Every match also gets a reason, e.g. "Matches preferred make: toyota"
export const scoreCandidate = (listing, profile) => {
  let score = 0;
  const reasons = [];
  const match = (points = 0, reason) => {
    if (points === 0) return;
    score += points;
    reasons.push(reason);
  };

  match(profile.categories.get(normalise(listing.category)), `Matches preferred category: ${listing.category}`);
  match(profile.locations.get(normalise(listing.location)), `Matches preferred location: ${listing.location}`);
  for (const { key, value, profileKey } of getMatchingAttributes(listing)) {
    match(profile.attributes.get(profileKey), `Matches preferred ${key}: ${value}`);
  }
  return { score, reasons };
};

// Highest score first; equal scores fall back to _id so the order is identical on every request
export const rankCandidates = (candidates, profile) =>
  candidates
    .map((listing) => ({ listing, ...scoreCandidate(listing, profile) }))
    .sort((a, b) => b.score - a.score || String(a.listing._id).localeCompare(String(b.listing._id)));

// Newest first; equal createdAt falls back to _id (desc) so the order is identical on every request.
// ObjectId hex strings all have the same length, so comparing them as strings is safe.
const newestFirst = (a, b) =>
  new Date(b.createdAt) - new Date(a.createdAt) || String(b._id).localeCompare(String(a._id));

// Default feed order, used for cold start and for the listings that aren't recommended.
// It uses only listing data (never other users' activity), so users stay isolated.
// Categories are interleaved round-robin: 1st vehicle, 1st property, 1st electronics, 1st furniture, 2nd vehicle, …
export const getDefaultOrder = (listings) => {
  // One newest-first queue per category (the Listing model's enum guarantees every category is in the order)
  const queues = DEFAULT_FEED_CATEGORY_ORDER.map((category) =>
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

const toItem = (listing) => ({ listing });

// The whole feed for one user.
// interactions: the user's own interactions; interactedListings: the listings they point to that still exist;
// candidates: every listing the user hasn't interacted with.
// Returns { isNewUser, message, recommendations: [{ listing, score, reasons }], others: [{ listing }] }
export const recommendForUser = ({ interactions, interactedListings, candidates }) => {
  // Cold start: no history (interactions pointing at deleted listings are ignored), so show the default feed
  if (interactedListings.length === 0) {
    return {
      isNewUser: true,
      message: "No activity yet, so here are the latest listings from every category.",
      recommendations: [],
      others: getDefaultOrder(candidates).map(toItem),
    };
  }

  const profile = buildProfile(interactedListings, getInteractionPoints(interactions));
  // A score of 0 matches nothing in the profile, so it isn't recommended
  const recommendations = rankCandidates(candidates, profile)
    .filter((item) => item.score > 0)
    .slice(0, RECOMMENDATION_LIMIT);

  // Everything else in default order, with the listings the user already interacted with at the end
  const recommendedIds = new Set(recommendations.map((item) => String(item.listing._id)));
  const others = [
    ...getDefaultOrder(candidates).filter((listing) => !recommendedIds.has(String(listing._id))),
    ...getDefaultOrder(interactedListings),
  ].map(toItem);

  let message = null;
  if (candidates.length === 0) {
    message = "You've interacted with every listing. Check back when new ones are posted.";
  } else if (recommendations.length === 0) {
    message = "No listings match your activity yet, so here are the latest listings.";
  }

  return { isNewUser: false, message, recommendations, others };
};
