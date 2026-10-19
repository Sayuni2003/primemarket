// Every number used by the recommendation logic lives here, so it is easy to find, explain and change.

// How strongly each action signals interest
export const ACTION_WEIGHTS = { view: 1, save: 3, contact_seller: 5 };

// Two attributes per category. Every category gets the same number of tags (fairness).
// primary = the most specific signal of what the user wants, secondary = a supporting detail
export const CATEGORY_FEATURES = {
  vehicle:     { primary: "make",         secondary: "fuelType" },
  property:    { primary: "propertyType", secondary: "bedrooms" },
  electronics: { primary: "brand",        secondary: "type" },
  furniture:   { primary: "type",         secondary: "material" },
};

// How much a match on each tag type counts when scoring
export const TAG_WEIGHTS = { category: 1, primary: 2, secondary: 1, location: 1 };

export const FOR_YOU_LIMIT = 8;
export const CATEGORY_ORDER = ["vehicle", "property", "electronics", "furniture"];

// Human-readable category names, used in reasons like "Because you've been browsing Vehicles"
export const CATEGORY_LABELS = {
  vehicle: "Vehicles",
  property: "Property",
  electronics: "Electronics",
  furniture: "Furniture",
};
