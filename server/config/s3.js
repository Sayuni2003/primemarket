import { S3Client } from "@aws-sdk/client-s3";

// Credentials are read from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment
export const s3 = new S3Client({ region: process.env.AWS_REGION });
