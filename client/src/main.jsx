import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// StrictMode runs effects twice in development to surface bugs. That's why interactions are
// recorded in click handlers, never in effects: an effect would record every "view" twice
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
