# HNG Stage 4B | WhisperBox: End-to-End Encrypted Messenger

## Project Overview

WhisperBox is a simple messaging app that keeps messages private using End-to-End Encryption (E2EE).

All encryption and decryption happen in the browser, so the server never sees any readable messages.

It uses RSA to securely share keys and AES to encrypt messages quickly. Private keys are protected with a password and are never stored in plain text.

---

## Live Demo

- [Live URL](https://hng-stage4b-encrypted-messenger.vercel.app/)

---

## Features

- User registration with automatic key generation
- Secure login with private key recovery
- End-to-end encrypted messaging
- Real-time messaging with WebSocket
- User search by username or display name
- Load and decrypt conversation history
- Simple form validation
- Encryption status indicator
- Responsive dark UI
- No plaintext stored on the server

---

## Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────┐
│                       CLIENT (Browser)                       │
│                                                              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐       │
│ │ config.js│ │ crypto.js│ │ auth.js  │ │websocket.js │       │
│ │(API URLs)│ │(encrypt/ │ │(register,│ │ (real-time  │       │
│ │          │ │ decrypt) │ │ login)   │ │ messaging)  │       │
│ └──────────┘ └──────────┘ └──────────┘ └─────────────┘       │
│       │             │            │             │             │
│       └──────┬──────┴──────┬─────┴─────────────┘             │
│              │             │                                 │
│       ┌──────┴─────────────┴───────┐                         │
│       │           app.js           │                         │
│       │ (UI logic, coordination,   │                         │
│       │      form validation)      │                         │
│       └────────────────────────────┘                         │
│                      │                                       │
└──────────────────────┼───────────────────────────────────────┘
                       │
          HTTPS / WSS (TLS encrypted)
                       │
┌──────────────────────┼───────────────────────────────────────┐
│              SERVER (WhisperBox API)                         │
│                                                              │
│  Stores:                                                     │
│  • Public keys (RSA-OAEP, base64)                            │
│  • Wrapped private keys (AES-GCM encrypted, base64)          │
│  • PBKDF2 salts (base64)                                     │
│  • Encrypted message payloads (ciphertext only)              │
│                                                              │
│  NEVER sees:                                                 │
│  • Plaintext messages                                        │
│  • User passwords                                            │
│  • Unwrapped private keys                                    │
│  • AES-GCM message keys                                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Encryption Flow Explanation

### How Encryption Works (Simple Explanation)

- RSA → secures key exchange
- AES → encrypts message data
- This approach is both fast and secure.

---

### Sending a Message

1. Get the recipient’s public key
2. Generate a random AES key (used once)
3. Generate an IV
4. Encrypt the message using AES → ciphertext
5. Encrypt the AES key using the recipient’s public key
6. Also encrypt the AES key with your own public key (so you can read it later)
7. Send everything to the server

---

### Receiving a Message

1. Receive the encrypted data
2. Decrypt the AES key using your private key
3. Use the AES key to decrypt the message
4. Display the original message

---

### How Keys Are Protected

#### During Registration

- RSA keys are generated in the browser
- A salt is created
- A key is derived from the password using PBKDF2
- The private key is encrypted using this derived key
- The server stores only:
  - public key
  - encrypted private key
  - salt

#### During Login

- The encrypted private key and salt are fetched
- The password is used to recreate the same key
- The private key is decrypted in memory

---

## Key Management Explanation

### Where Keys Are Stored

| Key                 | Created | Stored      | Lifetime     |
| ------------------- | ------- | ----------- | ------------ |
| RSA Public Key      | Client  | Server      | Permanent    |
| RSA Private Key     | Client  | Memory only | Session      |
| Wrapped Private Key | Client  | Server      | Permanent    |
| PBKDF2 Salt         | Client  | Server      | Permanent    |
| AES Message Key     | Client  | Not stored  | Per message  |
| Access Token        | Server  | Memory      | Short-lived  |
| Refresh Token       | Server  | Memory      | Until logout |

---

### Important Security Notes

- The private key is never stored in plain text
- It exists only in memory during a session
- The server never sees any readable messages
- A new AES key is used for every message
- All encryption happens in the browser

---

## Security Strengths and Limitations

### What Works Well

- Messages are fully end-to-end encrypted
- Each message uses a new encryption key
- Private keys are protected with a password
- No plaintext data is stored
- AES-GCM ensures both security and integrity

---

### Limitations

- No forward secrecy  
  If a private key is ever leaked, old messages can be decrypted

- Session resets on refresh  
  The user has to log in again

- No message signing  
  The sender is not cryptographically verified

- Depends on password strength  
  Weak passwords reduce security

- No offline support  
  Internet connection is required

- Tokens are stored in memory  
  They are lost after refresh

---

## Known Limitations

- No read receipts
- No typing indicators
- No file sharing
- No group chats
- No message editing or deletion
- No auto-reconnect for WebSocket
- Private key is lost on refresh

---

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Web Crypto API
- WebSocket API
- Fetch API

---

## Project Structure

```
hng-stage4b-encrypted-messenger/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── config.js
│   ├── crypto.js
│   ├── auth.js
│   ├── websocket.js
│   └── app.js
└── README.md
```

---

## Setup Instructions

```bash
git clone https://github.com/iibrahimx/hng-stage4b-encrypted-messenger.git
cd hng-stage4b-encrypted-messenger
```

Run a local server:

```bash
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Open in browser:

```
http://localhost:8000
```

---

## How to Use

### Register

- Create an account with username and password
- Keys are generated automatically

### Send Message

- Search for a user
- Open chat and send message

### Read Message

- Messages are decrypted in your browser

---

## API Reference

Base URL:

```
https://whisperbox.koyeb.app
```

Endpoints:

| Method | Endpoint                     | Description        |
| ------ | ---------------------------- | ------------------ |
| POST   | /auth/register               | Register           |
| POST   | /auth/login                  | Login              |
| GET    | /users/search                | Search users       |
| GET    | /users/{id}/public-key       | Get public key     |
| GET    | /conversations               | List conversations |
| GET    | /conversations/{id}/messages | Messages           |
| WS     | /ws?token=                   | WebSocket          |

---

## License

This project was built for the HNG Internship Stage 4B task.
