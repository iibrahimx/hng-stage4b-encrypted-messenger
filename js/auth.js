/**
 * auth.js — Bridge Between Our Encryption Machines and the Server
 *
 * This file handles:
 *   - Registering a new user (creating keys + sending to server)
 *   - Logging in (getting keys back + unlocking the private key)
 *   - Storing tokens and keys for other parts of the app to use
 */

// ============================================================
// IN-MEMORY WALLET
// Stores tokens and keys. Nothing here is written to disk.
// ============================================================

const session = {
  accessToken: null, // Short-term pass (expires in 15 minutes)
  refreshToken: null, // Long-term pass (for getting new access tokens)
  currentUser: null, // The logged-in user's profile
  privateKey: null, // The unwrapped RSA private key (NEVER leaves memory)
};

// ============================================================
// REGISTRATION — Creating a New Account
// ============================================================

/**
 * Registers a brand new user on the WhisperBox server.
 * Generates all keys, wraps the private key, and sends everything.
 *
 * @param {string} username - The desired username
 * @param {string} displayName - The display name shown to other users
 * @param {string} password - The user's password
 * @returns {Promise<object>} - The user profile from the server
 */
async function registerUser(username, displayName, password) {
  // Generate the RSA keypair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"],
  );

  // Export the public key as base64
  const publicKeyBytes = await crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey,
  );
  const publicKeyBase64 = arrayBufferToBase64(publicKeyBytes);

  // Generate salt and wrap the private key
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKey(password, salt);
  const wrappedPrivateKeyBytes = await wrapPrivateKey(
    keyPair.privateKey,
    wrappingKey,
  );
  const wrappedPrivateKeyBase64 = arrayBufferToBase64(wrappedPrivateKeyBytes);
  const saltBase64 = arrayBufferToBase64(salt);

  // Send to server
  const response = await fetch(getUrl(CONFIG.ENDPOINTS.REGISTER), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username,
      display_name: displayName,
      password: password,
      public_key: publicKeyBase64,
      wrapped_private_key: wrappedPrivateKeyBase64,
      pbkdf2_salt: saltBase64,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();

    // The server might return 'detail' as a string or an object
    // We need to handle both cases
    let errorMessage = "Registration failed";

    if (errorData.detail) {
      if (typeof errorData.detail === "string") {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        // Some APIs return an array of error objects
        errorMessage = errorData.detail
          .map((e) => e.msg || JSON.stringify(e))
          .join(", ");
      } else if (typeof errorData.detail === "object") {
        // The detail might be an object with field-level errors
        errorMessage = JSON.stringify(errorData.detail);
      }
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Save to session
  session.accessToken = data.access_token;
  session.refreshToken = data.refresh_token;
  session.currentUser = data.user;
  session.privateKey = keyPair.privateKey;

  return data.user;
}

// ============================================================
// LOGIN — Returning to an Existing Account
// ============================================================

/**
 * Logs into an existing account.
 * Retrieves the wrapped private key, unwraps it, and sets up the session.
 *
 * @param {string} username - The user's username
 * @param {string} password - The user's password
 * @returns {Promise<object>} - The user profile from the server
 */
async function loginUser(username, password) {
  // Send login request
  const response = await fetch(getUrl(CONFIG.ENDPOINTS.LOGIN), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username,
      password: password,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();

    let errorMessage = "Login failed";

    if (errorData.detail) {
      if (typeof errorData.detail === "string") {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail
          .map((e) => e.msg || JSON.stringify(e))
          .join(", ");
      } else if (typeof errorData.detail === "object") {
        errorMessage = JSON.stringify(errorData.detail);
      }
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Unwrap the private key
  const wrappedPrivateKeyBytes = base64ToArrayBuffer(
    data.user.wrapped_private_key,
  );
  const saltBytes = base64ToArrayBuffer(data.user.pbkdf2_salt);
  const wrappingKey = await deriveWrappingKey(password, saltBytes);
  const privateKey = await unwrapPrivateKey(
    wrappedPrivateKeyBytes,
    wrappingKey,
  );

  // Save to session
  session.accessToken = data.access_token;
  session.refreshToken = data.refresh_token;
  session.currentUser = data.user;
  session.privateKey = privateKey;

  return data.user;
}
