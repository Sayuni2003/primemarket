import mongoose from "mongoose";

export const LISTING_CATEGORIES = [
  "property",
  "vehicle",
  "electronics",
  "furniture",
];

// Category-specific details, e.g. { key: "bedrooms", value: 3 } or { key: "fuelType", value: "petrol" }
const attributeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

// Seller details are embedded so listings can be shown without a lookup
const sellerSchema = new mongoose.Schema(
  {
    sellerId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    phoneNo: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: LISTING_CATEGORIES },
    location: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    attributes: { type: [attributeSchema], default: [] },
    // S3 object key (e.g. "listings/abc123.jpg"), not a URL; presigned URLs are generated on read
    imageKey: { type: String, trim: true },
    seller: { type: sellerSchema, required: true },
  },
  { timestamps: true },
);

listingSchema.index({ category: 1, price: 1 });
listingSchema.index({ location: 1 });
listingSchema.index({ "attributes.key": 1, "attributes.value": 1 });
listingSchema.index({ title: "text" });

export default mongoose.model("Listing", listingSchema);
