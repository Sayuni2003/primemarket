// Display helpers shared by the listing card and the modal

// "vehicle" → "Vehicle"
export const capitalise = (text) => {
  const value = String(text);
  return value.charAt(0).toUpperCase() + value.slice(1);
};

// 8500000 → "LKR 8,500,000"
const priceFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
});
export const formatPrice = (price) => priceFormatter.format(price);

// Readable names for the attribute keys used in the seed data; unknown keys are shown as they are
const ATTRIBUTE_LABELS = {
  make: "Make",
  model: "Model",
  year: "Year",
  fuelType: "Fuel",
  transmission: "Transmission",
  mileageKm: "Mileage",
  propertyType: "Type",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  sizeSqft: "Size",
  landPerches: "Land",
  brand: "Brand",
  type: "Type",
  condition: "Condition",
  material: "Material",
};

// Numbers that need a unit and thousands separators (year is a number too, but "2,017" would be wrong)
const ATTRIBUTE_UNITS = { mileageKm: "km", sizeSqft: "sq ft", landPerches: "perches" };

// { key: "mileageKm", value: 72000 } → { label: "Mileage", value: "72,000 km" }
export const formatAttribute = ({ key, value }) => {
  const unit = ATTRIBUTE_UNITS[key];
  return {
    label: ATTRIBUTE_LABELS[key] ?? key,
    value: unit ? `${Number(value).toLocaleString("en-LK")} ${unit}` : capitalise(value),
  };
};

// The attributes worth showing on a card, most useful first. The title already names make and model
const KEY_ATTRIBUTES = {
  vehicle: ["year", "fuelType", "mileageKm"],
  property: ["propertyType", "bedrooms", "sizeSqft", "landPerches"],
  electronics: ["brand", "type", "condition"],
  furniture: ["type", "material", "condition"],
};

// Up to 3 key attributes the listing actually has (land has no bedrooms, so it shows land size instead)
export const getKeyAttributes = (listing) =>
  (KEY_ATTRIBUTES[listing.category] ?? [])
    .map((key) => listing.attributes.find((attribute) => attribute.key === key))
    .filter(Boolean)
    .slice(0, 3);
