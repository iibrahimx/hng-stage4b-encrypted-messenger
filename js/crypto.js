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
 *
 * Turns a user's password into an encryption key using PBKDF2.
 * This key is used to encrypt (and later decrypt) the RSA private key.
 *
 * @param {string} password - The user's secret password
 * @param {Uint8Array} salt - Random salt bytes (makes every derived key unique)
 * @returns {Promise<CryptoKey>} - The derived encryption key
 */
async function deriveWrappingKey(password, salt) {
  // Turn the password string into raw bytes
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Import the password bytes as a "base key" material
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Use PBKDF2 to derive an AES-GCM key
  // This is the same secure key derivation, but now produces
  // an AES-GCM key that can encrypt and decrypt directly
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Function 2: wrapPrivateKey
 *
 * Protects the RSA private key for storage on the server.
 *
 * How it works (step by step):
 *   1. Export the private key to pkcs8 format (standard binary format)
 *   2. Generate a random IV (starting position) for AES-GCM
 *   3. Encrypt the pkcs8 bytes with AES-GCM using the wrapping key
 *   4. Combine the IV and encrypted bytes into a single package
 *   5. Return the combined package
 *
 * Why AES-GCM instead of AES-KW:
 *   AES-KW has strict alignment requirements that can fail with RSA keys
 *   in some browsers. AES-GCM has no such restriction and is equally secure.
 *
 * @param {CryptoKey} privateKey - The RSA private key to protect
 * @param {CryptoKey} wrappingKey - The key derived from the user's password
 * @returns {Promise<ArrayBuffer>} - The encrypted private key (IV prepended)
 */
async function wrapPrivateKey(privateKey, wrappingKey) {
  // Export the private key to raw pkcs8 bytes
  // This gives an ArrayBuffer we can encrypt directly
  const pkcs8Bytes = await crypto.subtle.exportKey("pkcs8", privateKey);

  // Generate a random IV for AES-GCM
  // 12 bytes is the standard for AES-GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Step 3: Encrypt the pkcs8 bytes with AES-GCM
  const encryptedBytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    wrappingKey,
    pkcs8Bytes,
  );

  // Combine IV + encrypted data into one package
  // The IV must be sent along with the encrypted data for decryption
  const combined = new Uint8Array(iv.length + encryptedBytes.byteLength);
  combined.set(iv, 0); // Put IV at the beginning
  combined.set(new Uint8Array(encryptedBytes), iv.length); // Then the encrypted data

  return combined.buffer;
}

/**
 * Function 3: unwrapPrivateKey
 *
 * Recovers the RSA private key from its encrypted form.
 * This is the reverse of wrapPrivateKey.
 *
 * How it works (step by step):
 *   1. Extract the IV from the beginning of the combined package
 *   2. Extract the encrypted data from the rest
 *   3. Decrypt with AES-GCM using the wrapping key
 *   4. Import the decrypted pkcs8 bytes back into a CryptoKey object
 *
 * @param {ArrayBuffer} wrappedData - The combined IV + encrypted private key
 * @param {CryptoKey} wrappingKey - The key re-derived from the user's password
 * @returns {Promise<CryptoKey>} - The unlocked RSA private key
 */
async function unwrapPrivateKey(wrappedData, wrappingKey) {
  // Split the combined package into IV and encrypted data
  const combined = new Uint8Array(wrappedData);

  // The first 12 bytes are the IV
  const iv = combined.slice(0, 12);

  // The rest is the encrypted pkcs8 data
  const encryptedData = combined.slice(12);

  // Decrypt with AES-GCM
  const decryptedBytes = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    wrappingKey,
    encryptedData,
  );

  // Import the decrypted pkcs8 bytes as an RSA private key
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    decryptedBytes,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false, // Not extractable again
    ["decrypt"], // Only needed for decryption
  );

  return privateKey;
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
