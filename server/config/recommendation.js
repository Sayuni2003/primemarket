// Every number used by the recommendation logic lives here, so it is easy to find, explain and change.

// How strongly each interaction type signals interest
export const INTERACTION_WEIGHTS = { view: 1, save: 3, contact_seller: 5 };

// The most times each interaction type is counted per listing, so repeating it can't grow a listing's
// influence forever. save is counted once anyway: the unique index lets a user save a listing only once
export const INTERACTION_CAPS = { view: 3, save: 1, contact_seller: 2 };

// Attributes compared per category. Location is matched separately because it's a top-level listing field
export const MATCHING_ATTRIBUTES = {
  property: ["propertyType", "bedrooms"],
  vehicle: ["make", "fuelType"],
  electronics: ["brand", "type"],
  furniture: ["type", "material"],
};

// The most listings returned in recommendations; every other listing goes to others
export const RECOMMENDATION_LIMIT = 8;

// Default feed: newest first within each category, categories interleaved in this order
export const DEFAULT_FEED_CATEGORY_ORDER = ["vehicle", "property", "electronics", "furniture"];
