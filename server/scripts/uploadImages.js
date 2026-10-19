import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AWS_ENV_VARS, requireEnv } from "../config/env.js";
import { IMAGES_DIR, MAX_IMAGE_BYTES, contentTypeFor, imageKeyFor, listImageFiles } from "../config/images.js";
import { uploadImage } from "../services/s3.js";

// Uploads every image in scripts/images/ to listings/<filename>. Re-running overwrites the same keys
requireEnv(AWS_ENV_VARS);

const files = listImageFiles();

if (files.length === 0) {
  console.log(`No images in ${IMAGES_DIR}. Add .jpg, .jpeg, .png or .webp files and run again.`);
  process.exit(0);
}

let uploaded = 0;

// One at a time keeps the output in order; with a handful of small files speed doesn't matter
for (const file of files) {
  const key = imageKeyFor(file);
  try {
    const buffer = await readFile(path.join(IMAGES_DIR, file));
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new Error(`file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB, the limit is 1 MB`);
    }
    await uploadImage(key, buffer, contentTypeFor(file));
    console.log(`OK      ${key}`);
    uploaded++;
  } catch (err) {
    console.error(`FAILED  ${key}: ${err.message}`);
  }
}

console.log(`${uploaded}/${files.length} uploaded`);
if (uploaded < files.length) process.exitCode = 1;
