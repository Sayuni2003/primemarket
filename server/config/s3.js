import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client;

// Created on first use so the server still starts when AWS isn't configured.
// Credentials are read from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment
export const getS3 = () => {
  client ??= new S3Client({ region: process.env.AWS_REGION });
  return client;
};

// Presigned GET URL for a stored object key; null when there is no image or S3 isn't configured
export const getImageUrl = async (key) => {
  if (!key || !process.env.AWS_S3_BUCKET || !process.env.AWS_REGION) return null;
  const command = new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key });
  return getSignedUrl(getS3(), command, { expiresIn: 3600 });
};
