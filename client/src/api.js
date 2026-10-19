import axios from "axios";

// One axios instance for the whole app. "/api" is forwarded to the backend by the proxy in vite.config.js
const api = axios.create({ baseURL: "/api" });

// The backend answers every error with { message }, e.g. { message: "User not found" }.
// No message means the backend never answered: either there was no response at all, or the
// Vite proxy couldn't reach the server and replied with an empty 502 Bad Gateway itself.
const toReadableError = (err) =>
  new Error(err.response?.data?.message || "Backend not reachable — is the server running?");

// Runs on every failed request, so components only ever need err.message
api.interceptors.response.use(
  (response) => response,
  (err) => Promise.reject(toReadableError(err))
);

// GET /api/users → [{ _id, name }]
export const getUsers = async () => {
  const response = await api.get("/users");
  return response.data;
};

// GET /api/recommendations?userId= → { userId, isNewUser, message, recommendations, others }
export const getRecommendations = async (userId) => {
  const response = await api.get("/recommendations", { params: { userId } });
  return response.data;
};

// POST /api/interactions, type is one of "view", "save", "contact_seller" → the stored interaction
export const recordInteraction = async (userId, listingId, type) => {
  const response = await api.post("/interactions", { userId, listingId, type });
  return response.data;
};
