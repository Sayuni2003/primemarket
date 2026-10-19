import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Short enough that a leaked link soon stops working, long enough to load a page of images
export const URL_EXPIRY_SECONDS = 300;

let client;

// One shared client, created on first use so the app still starts without AWS (e.g. in tests).
// Credentials aren't passed in: the SDK reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the environment
export const getS3 = () => {
  client ??= new S3Client({ region: process.env.AWS_REGION });
  return client;
};

// Turns AWS error codes into messages that say what to fix
export const describeS3Error = (err, key) => {
  const bucket = process.env.AWS_S3_BUCKET;
  switch (err.name) {
    case "NoSuchKey":
    case "NotFound":
      return `No object at "${key}" in bucket "${bucket}". Run npm run upload:images first.`;
    case "NoSuchBucket":
      return `Bucket "${bucket}" doesn't exist. Check AWS_S3_BUCKET in .env.`;
    case "AccessDenied":
    case "Forbidden":
      return `Access denied for "${key}". Check AWS_S3_BUCKET and that the IAM policy allows this action on the bucket.`;
    case "PermanentRedirect":
    case "AuthorizationHeaderMalformed":
      return `Bucket "${bucket}" isn't in region "${process.env.AWS_REGION}". Set AWS_REGION to the bucket's region.`;
    case "InvalidAccessKeyId":
    case "SignatureDoesNotMatch":
      return "AWS rejected the credentials. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.";
    case "CredentialsProviderError":
      return "No AWS credentials found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.";
    default:
      return `S3 error (${err.name}): ${err.message}`;
  }
};

// Uploading to an existing key overwrites it, so re-uploads never create duplicates
export const uploadImage = async (key, buffer, contentType) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    // Without this S3 serves application/octet-stream and browsers download the file instead of showing it
    ContentType: contentType,
  });
  try {
    await getS3().send(command);
  } catch (err) {
    throw new Error(describeS3Error(err, key), { cause: err });
  }
};

// Presigned GET URL for a stored key; null when there is no image or S3 isn't configured.
// Signing happens locally with the secret key and never calls AWS, so a missing object or
// wrong policy only shows up when the browser loads the URL
export const getImageUrl = async (key) => {
  if (!key || !process.env.AWS_S3_BUCKET || !process.env.AWS_REGION) return null;
  const command = new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key });
  try {
    return await getSignedUrl(getS3(), command, { expiresIn: URL_EXPIRY_SECONDS });
  } catch (err) {
    throw new Error(describeS3Error(err, key), { cause: err });
  }
};
