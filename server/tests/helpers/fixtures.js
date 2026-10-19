// Small listing builder for tests: only the fields that matter are passed in, the rest are filled with valid defaults.
// daysAgo sets createdAt, so the default (newest-first) order is predictable.
export const makeListing = ({ title, category, location, attributes = {}, daysAgo = 0, ...rest }) => ({
  title,
  category,
  location,
  price: 1000,
  // { make: "toyota" } → [{ key: "make", value: "toyota" }]
  attributes: Object.entries(attributes).map(([key, value]) => ({ key, value })),
  seller: { sellerId: "s1", name: "Test Seller", phoneNo: "070 000 0000" },
  createdAt: new Date(Date.UTC(2026, 0, 31 - daysAgo)),
  ...rest,
});
