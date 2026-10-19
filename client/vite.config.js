import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward every /api request to the Express backend (PORT in server/.env).
    // The browser only ever talks to the Vite dev server, so there are no CORS issues in development
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
