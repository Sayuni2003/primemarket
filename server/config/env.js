export const AWS_ENV_VARS = ["AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_S3_BUCKET"];

// Exits with one message naming every missing variable (names only, never values)
export const requireEnv = (names) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(", ")}. Fill them in server/.env (see .env.example).`);
    process.exit(1);
  }
};
