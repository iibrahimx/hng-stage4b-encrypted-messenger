/**
 * crypto.js — Our Digital Lockbox, Envelope, and Safe Factory
 *
 * This file contains all the encryption and decryption operations
 * required for end-to-end encrypted messaging.
 *
 * Physical Analogy Reference:
 *   - Safe (AES-KW)     → Protects your private key using your password
 *   - Lockbox (RSA-OAEP) → Protects the one-time AES key during delivery
 *   - Envelope (AES-GCM) → Protects the actual message
 */

// ============================================================
// TINY HELPER: Base64 to ArrayBuffer conversion
// It is use constantly because the server sends/receives base64
// ============================================================

/**
 * Converts a base64 string into raw bytes (ArrayBuffer).
 * Base64 is just a way to represent bytes as text.
 *
 * @param {string} base64 - A base64 encoded string
 * @returns {ArrayBuffer} - The decoded bytes
 */
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64); // atob = "ASCII to Binary" — decodes base64
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts raw bytes (ArrayBuffer) into a base64 string.
 * We use this before sending encrypted data to the server.
 *
 * @param {ArrayBuffer} buffer - The raw bytes
 * @returns {string} - The base64 encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binaryString = "";
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }
  return btoa(binaryString); // btoa = "Binary to ASCII" — encodes to base64
}

// ============================================================
// PART 1: THE SAFE — Protecting Your Private Key with a Password
// ============================================================

/**
 * Function 1: deriveWrappingKey
 * Turns a user's password into a special "safe key" (AES-KW wrapping key).
 */
async function deriveWrappingKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

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

/**
 * Function 2: wrapPrivateKey
 * Locks a private key inside a safe using the wrapping key.
 */
async function wrapPrivateKey(privateKey, wrappingKey) {
  return crypto.subtle.wrapKey("pkcs8", privateKey, wrappingKey, "AES-KW");
}

/**
 * Function 3: unwrapPrivateKey
 * Opens the safe and retrieves the private key.
 */
async function unwrapPrivateKey(wrappedKey, wrappingKey) {
  return crypto.subtle.unwrapKey(
    "pkcs8",
    wrappedKey,
    wrappingKey,
    "AES-KW",
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
}

// ============================================================
// PART 2: THE ENVELOPE — Encrypting and Decrypting Messages
// ============================================================

/**
 * Function 4: generateAESKey
 * Creates a brand new, random, one-time AES-GCM key.
 */
async function generateAESKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Function 5: encryptMessage
 * Locks a plaintext message inside an AES-GCM envelope.
 */
async function encryptMessage(aesKey, plaintext) {
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(plaintext);

  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    aesKey,
    messageBytes,
  );

  return { ciphertext, iv };
}

// ============================================================
// PART 3: THE LOCKBOX — Protecting the AES Key with RSA
// ============================================================

/**
 * Helper: importPublicKey
 * Converts a public key from a base64 string into a CryptoKey object.
 */
async function importPublicKey(base64Key) {
  const keyBytes = base64ToArrayBuffer(base64Key);

  return crypto.subtle.importKey(
    "spki",
    keyBytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
}

/**
 * Function 6: encryptAESKeyWithRSA
 * Locks the one-time AES key inside an RSA lockbox using someone's public key.
 */
async function encryptAESKeyWithRSA(aesKey, publicKeyBase64) {
  const publicKey = await importPublicKey(publicKeyBase64);

  return crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, aesKey);
}

// ============================================================
// PART 4: THE RECEIVING END — Decrypting a Message
// ============================================================

/**
 * Function 8: decryptMessage
 * The complete decryption process:
 * 1. Open the RSA lockbox with your private key → get AES key
 * 2. Open the AES envelope with that AES key → get the original message
 */
async function decryptMessage(privateKey, payload) {
  const encryptedKeyBytes = base64ToArrayBuffer(payload.encryptedKey);
  const ciphertextBytes = base64ToArrayBuffer(payload.ciphertext);
  const ivBytes = base64ToArrayBuffer(payload.iv);

  const aesKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    encryptedKeyBytes,
  );

  const aesCryptoKey = await crypto.subtle.importKey(
    "raw",
    aesKey,
    "AES-GCM",
    false,
    ["decrypt"],
  );

  const decryptedBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    aesCryptoKey,
    ciphertextBytes,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBytes);
}
