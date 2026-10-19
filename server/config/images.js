import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Shared by the upload script and the seed, so seeded keys always match what was uploaded
export const IMAGES_DIR = fileURLToPath(new URL("../scripts/images/", import.meta.url));

export const IMAGE_CONTENT_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const MAX_IMAGE_BYTES = 1024 * 1024;

export const contentTypeFor = (filename) => IMAGE_CONTENT_TYPES[path.extname(filename).toLowerCase()];

export const imageKeyFor = (filename) => `listings/${filename}`;

// Image files in IMAGES_DIR (skips .gitkeep and anything else); [] if the folder is missing
export const listImageFiles = () => {
  try {
    return readdirSync(IMAGES_DIR).filter(contentTypeFor).sort();
  } catch {
    return [];
  }
};
