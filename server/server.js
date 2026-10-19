import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { AWS_ENV_VARS, requireEnv } from "./config/env.js";

requireEnv(["MONGO_URI", ...AWS_ENV_VARS]);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });
