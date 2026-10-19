import { getImageUrl, describeS3Error, URL_EXPIRY_SECONDS } from "../../services/s3.js";

// Presigning happens locally with the secret key, so fake credentials work without touching AWS
beforeAll(() => {
  Object.assign(process.env, {
    AWS_REGION: "us-east-1",
    AWS_S3_BUCKET: "test-bucket",
    AWS_ACCESS_KEY_ID: "AKIAFAKEFAKEFAKEFAKE",
    AWS_SECRET_ACCESS_KEY: "fake-secret",
  });
});

test("presigned URL points at the key, is signed and expires after 5 minutes", async () => {
  const url = new URL(await getImageUrl("listings/car-1.jpg"));

  expect(url.hostname).toBe("test-bucket.s3.us-east-1.amazonaws.com");
  expect(url.pathname).toBe("/listings/car-1.jpg");
  expect(URL_EXPIRY_SECONDS).toBe(300);
  expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
  expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy();
});

test("a listing without an image gets no URL", async () => {
  expect(await getImageUrl(undefined)).toBeNull();
});

test("AWS error codes become readable messages", () => {
  expect(describeS3Error({ name: "NoSuchKey" }, "listings/x.jpg")).toMatch(/No object at "listings\/x.jpg"/);
  expect(describeS3Error({ name: "AccessDenied" }, "listings/x.jpg")).toMatch(/Access denied/);
  expect(describeS3Error({ name: "PermanentRedirect" }, "listings/x.jpg")).toMatch(/isn't in region "us-east-1"/);
});
