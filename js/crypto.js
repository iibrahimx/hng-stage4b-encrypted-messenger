// Turns a user's password into a special "safe key" (AES-KW wrapping key).

async function deriveWrappingKey(password, salt) {
  // Turn the password string into raw bytes the machine can process
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Import the password bytes as a "base key" material
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2", // use the PBKDF2 blender
    false, // don't allow this key to be exported
    ["deriveKey"], // only use this to derive another key
  );

  // Use the PBKDF2 blender to derive the actual safe key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

// Locks a private key inside a safe using the wrapping key.
// The result (wrapped key) is safe to send to the server.

async function wrapPrivateKey(privateKey, wrappingKey) {
  return crypto.subtle.wrapKey("pkcs8", privateKey, wrappingKey, "AES-KW");
}

// Opens the safe and retrieves the private key using the wrapping key.
// This happens after login, when we get the wrapped key back from the server.

async function unwrapPrivateKey(wrappedKey, wrappingKey) {
  return crypto.subtle.unwrapKey(
    "pkcs8",
    wrappedKey,
    wrappingKey,
    "AES-KW",
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"],
  );
}
