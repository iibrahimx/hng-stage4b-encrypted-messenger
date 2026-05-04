// This file is like an address book
// All the important, unchanging values live here
// So they can be managed in one place

// Main address of our backend server
const BASE_URL = "https://whisperbox.koyeb.app";

// All server addresses (endpoints)
const CONFIG = {
  BASE_URL: BASE_URL,

  // The specific API endpoints on the server
  ENDPOINTS: {
    HEALTH: "/health",

    // Authentication
    REGISTER: "/auth/register",
    LOGIN: "/auth/login",
    ME: "/auth/me",
    REFRESH: "/auth/refresh",
    LOGOUT: "/auth/logout",

    // Users
    SEARCH_USERS: "/users/search",
    USER_PUBLIC_KEY: "/users",

    // Messages
    CONVERSATIONS: "/conversations",
    MESSAGES: "/messages",

    // WebSocket
    WEBSOCKET: "/ws",
  },
};

// Helper function to build full URL combining the base URL with an endpoint path.
function getUrl(endpoint) {
  return BASE_URL + endpoint;
}
