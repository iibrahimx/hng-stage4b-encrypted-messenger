/**
 * app.js — The Conductor of Our Orchestra
 *
 * This file coordinates everything:
 *   - Listens for button clicks and form submissions
 *   - Calls auth.js functions when users log in or register
 *   - Updates the UI based on application state
 *   - Manages which screen and form are visible
 *   - Handles form validation with inline error messages
 *   - Manages WebSocket connection for real-time messaging
 *   - Handles message encryption, sending, receiving, and decryption
 */

// ============================================================
// ELEMENT REFERENCES — Grabbing all HTML elements by their IDs
// ============================================================

// --- Screens ---
const authScreen = document.getElementById("auth-screen");
const chatScreen = document.getElementById("chat-screen");

// --- Auth Elements ---
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const showRegisterLink = document.getElementById("show-register");
const showLoginLink = document.getElementById("show-login");

// --- Login Inputs ---
const loginUsernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");

// --- Register Inputs ---
const registerUsernameInput = document.getElementById("register-username");
const registerDisplayNameInput = document.getElementById(
  "register-display-name",
);
const registerPasswordInput = document.getElementById("register-password");

// --- Error Message Elements ---
const loginUsernameError = document.getElementById("login-username-error");
const loginPasswordError = document.getElementById("login-password-error");
const registerUsernameError = document.getElementById(
  "register-username-error",
);
const registerDisplayNameError = document.getElementById(
  "register-display-name-error",
);
const registerPasswordError = document.getElementById(
  "register-password-error",
);

// --- Chat Elements ---
const conversationsList = document.getElementById("conversations-list");
const chatHeaderName = document.getElementById("chat-header-name");
const encryptionBadge = document.getElementById("encryption-badge");
const messagesContainer = document.getElementById("messages-container");
const noChatSelected = document.getElementById("no-chat-selected");
const messageInputContainer = document.getElementById(
  "message-input-container",
);
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const logoutBtn = document.getElementById("logout-btn");

// ============================================================
// APPLICATION STATE
// ============================================================

// The user we're currently chatting with (null if no chat is open)
let activeConversation = null;
// Cache for user profiles so we don't fetch them repeatedly
const userCache = {};
// Debounce timeout for search
let searchTimeout = null;

// ============================================================
// VALIDATION HELPERS
// ============================================================

function showInputError(inputElement, errorElement, message) {
  inputElement.classList.add("error");
  errorElement.textContent = message;
}

function clearInputError(inputElement, errorElement) {
  inputElement.classList.remove("error");
  errorElement.textContent = "";
}

function clearAllErrors(fields) {
  fields.forEach(function (field) {
    clearInputError(field.input, field.error);
  });
}

// Define field groups for easy clearing
const loginFields = [
  { input: loginUsernameInput, error: loginUsernameError },
  { input: loginPasswordInput, error: loginPasswordError },
];

const registerFields = [
  { input: registerUsernameInput, error: registerUsernameError },
  { input: registerDisplayNameInput, error: registerDisplayNameError },
  { input: registerPasswordInput, error: registerPasswordError },
];

// ============================================================
// TOGGLE BETWEEN LOGIN AND REGISTER FORMS
// ============================================================

showRegisterLink.addEventListener("click", function (event) {
  event.preventDefault();
  clearAllErrors(loginFields);
  clearAllErrors(registerFields);
  loginForm.reset();
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

showLoginLink.addEventListener("click", function (event) {
  event.preventDefault();
  clearAllErrors(loginFields);
  clearAllErrors(registerFields);
  registerForm.reset();
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

// ============================================================
// CLEAR ERRORS ON INPUT
// ============================================================

loginUsernameInput.addEventListener("input", function () {
  clearInputError(loginUsernameInput, loginUsernameError);
});

loginPasswordInput.addEventListener("input", function () {
  clearInputError(loginPasswordInput, loginPasswordError);
});

registerUsernameInput.addEventListener("input", function () {
  clearInputError(registerUsernameInput, registerUsernameError);
});

registerDisplayNameInput.addEventListener("input", function () {
  clearInputError(registerDisplayNameInput, registerDisplayNameError);
});

registerPasswordInput.addEventListener("input", function () {
  clearInputError(registerPasswordInput, registerPasswordError);
});

// ============================================================
// SCREEN SWITCHING
// ============================================================

function showScreen(screenToShow) {
  if (screenToShow === "chat") {
    authScreen.classList.remove("active");
    chatScreen.classList.add("active");
  } else {
    chatScreen.classList.remove("active");
    authScreen.classList.add("active");
  }
}

// ============================================================
// SIDEBAR USER INFO
// ============================================================

function updateSidebarUser(user) {
  const initial = user.display_name.charAt(0).toUpperCase();
  document.getElementById("current-user-avatar").textContent = initial;
  document.getElementById("current-user-name").textContent = user.display_name;
}

// ============================================================
// ENTER CHAT SCREEN (connects WebSocket and sets up listeners)
// ============================================================

async function enterChatScreen() {
  showScreen("chat");

  try {
    await connectWebSocket();
    console.log("WebSocket connected, ready for messages");
  } catch (error) {
    console.error("Failed to connect WebSocket:", error);
  }

  setupWebSocketListeners();
  loadConversations();
}

// ============================================================
// WEBSOCKET EVENT LISTENERS
// ============================================================

function setupWebSocketListeners() {
  onWebSocketEvent("message.receive", function (data) {
    handleIncomingMessage(data);
  });

  onWebSocketEvent("error", function (data) {
    console.error("WebSocket error event:", data.detail);
  });

  onWebSocketEvent("user.online", function (data) {
    console.log("User came online:", data.user_id);
  });

  onWebSocketEvent("user.offline", function (data) {
    console.log("User went offline:", data.user_id);
  });
}

// ============================================================
// LOGIN FORM HANDLER
// ============================================================

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  clearAllErrors(loginFields);

  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  let hasError = false;

  if (!username) {
    showInputError(
      loginUsernameInput,
      loginUsernameError,
      "Username is required.",
    );
    hasError = true;
  }

  if (!password) {
    showInputError(
      loginPasswordInput,
      loginPasswordError,
      "Password is required.",
    );
    hasError = true;
  }

  if (hasError) return;

  const submitButton = loginForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  submitButton.textContent = "Logging in...";
  submitButton.disabled = true;

  try {
    const user = await loginUser(username, password);
    updateSidebarUser(user);
    enterChatScreen();
    loginForm.reset();
  } catch (error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("username") || errorMessage.includes("user")) {
      showInputError(loginUsernameInput, loginUsernameError, error.message);
    } else if (
      errorMessage.includes("password") ||
      errorMessage.includes("credential")
    ) {
      showInputError(loginPasswordInput, loginPasswordError, error.message);
    } else {
      showInputError(loginPasswordInput, loginPasswordError, error.message);
    }
    submitButton.textContent = originalButtonText;
    submitButton.disabled = false;
  }
});

// ============================================================
// REGISTER FORM HANDLER
// ============================================================

registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  clearAllErrors(registerFields);

  const username = registerUsernameInput.value.trim();
  const displayName = registerDisplayNameInput.value.trim();
  const password = registerPasswordInput.value;

  let hasError = false;

  if (!username) {
    showInputError(
      registerUsernameInput,
      registerUsernameError,
      "Username is required.",
    );
    hasError = true;
  } else if (username.length < 3) {
    showInputError(
      registerUsernameInput,
      registerUsernameError,
      "Username must be at least 3 characters.",
    );
    hasError = true;
  } else if (username.length > 32) {
    showInputError(
      registerUsernameInput,
      registerUsernameError,
      "Username must be 32 characters or fewer.",
    );
    hasError = true;
  } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    showInputError(
      registerUsernameInput,
      registerUsernameError,
      "Username can only contain letters, numbers, underscores, and hyphens.",
    );
    hasError = true;
  }

  if (!displayName) {
    showInputError(
      registerDisplayNameInput,
      registerDisplayNameError,
      "Display name is required.",
    );
    hasError = true;
  }

  if (!password) {
    showInputError(
      registerPasswordInput,
      registerPasswordError,
      "Password is required.",
    );
    hasError = true;
  } else if (password.length < 8) {
    showInputError(
      registerPasswordInput,
      registerPasswordError,
      "Password must be at least 8 characters.",
    );
    hasError = true;
  } else if (password.length > 128) {
    showInputError(
      registerPasswordInput,
      registerPasswordError,
      "Password must be 128 characters or fewer.",
    );
    hasError = true;
  }

  if (hasError) return;

  const submitButton = registerForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  submitButton.textContent = "Creating Account...";
  submitButton.disabled = true;

  try {
    const user = await registerUser(username, displayName, password);
    updateSidebarUser(user);
    enterChatScreen();
    registerForm.reset();
  } catch (error) {
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("username") || errorMessage.includes("taken")) {
      showInputError(
        registerUsernameInput,
        registerUsernameError,
        error.message,
      );
    } else if (errorMessage.includes("display")) {
      showInputError(
        registerDisplayNameInput,
        registerDisplayNameError,
        error.message,
      );
    } else if (errorMessage.includes("password")) {
      showInputError(
        registerPasswordInput,
        registerPasswordError,
        error.message,
      );
    } else {
      showInputError(
        registerPasswordInput,
        registerPasswordError,
        error.message,
      );
    }
    submitButton.textContent = originalButtonText;
    submitButton.disabled = false;
  }
});

// ============================================================
// USER SEARCH
// ============================================================

searchInput.addEventListener("input", function () {
  clearTimeout(searchTimeout);

  const query = searchInput.value.trim();

  if (!query) {
    searchResults.classList.add("hidden");
    searchResults.innerHTML = "";
    return;
  }

  searchTimeout = setTimeout(async function () {
    try {
      const users = await searchUsers(query);
      displaySearchResults(users);
    } catch (error) {
      console.error("Search failed:", error);
    }
  }, 300);
});

async function searchUsers(query) {
  const url =
    getUrl(CONFIG.ENDPOINTS.SEARCH_USERS) + "?q=" + encodeURIComponent(query);

  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + session.accessToken,
    },
  });

  if (!response.ok) throw new Error("Search failed");

  return response.json();
}

function displaySearchResults(users) {
  searchResults.innerHTML = "";

  if (users.length === 0) {
    searchResults.innerHTML =
      '<div class="search-result-item">No users found</div>';
    searchResults.classList.remove("hidden");
    return;
  }

  users.forEach(function (user) {
    userCache[user.id] = user;

    const item = document.createElement("div");
    item.className = "search-result-item";
    item.innerHTML = `
            <div class="conversation-avatar">${user.display_name.charAt(0).toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-name">${user.display_name}</div>
                <div class="conversation-username">@${user.username}</div>
            </div>
        `;

    item.addEventListener("click", function () {
      openConversation(user);
      searchInput.value = "";
      searchResults.classList.add("hidden");
      searchResults.innerHTML = "";
    });

    searchResults.appendChild(item);
  });

  searchResults.classList.remove("hidden");
}

// Hide search results when clicking outside
document.addEventListener("click", function (event) {
  if (
    !searchInput.contains(event.target) &&
    !searchResults.contains(event.target)
  ) {
    searchResults.classList.add("hidden");
  }
});

// ============================================================
// CONVERSATIONS
// ============================================================

async function loadConversations() {
  try {
    const url = getUrl(CONFIG.ENDPOINTS.CONVERSATIONS);

    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + session.accessToken,
      },
    });

    if (!response.ok) throw new Error("Failed to load conversations");

    const conversations = await response.json();
    displayConversations(conversations);
  } catch (error) {
    console.error("Error loading conversations:", error);
  }
}

function displayConversations(conversations) {
  conversationsList.innerHTML = "";

  if (conversations.length === 0) {
    conversationsList.innerHTML =
      '<div style="padding: 16px; color: #888; text-align: center;">No conversations yet</div>';
    return;
  }

  conversations.forEach(function (conv) {
    userCache[conv.user_id] = {
      id: conv.user_id,
      username: conv.username,
      display_name: conv.display_name,
    };

    const item = document.createElement("div");
    item.className = "conversation-item";
    item.innerHTML = `
            <div class="conversation-avatar">${conv.display_name.charAt(0).toUpperCase()}</div>
            <div class="conversation-info">
                <div class="conversation-name">${conv.display_name}</div>
                <div class="conversation-username">@${conv.username}</div>
            </div>
        `;

    item.addEventListener("click", function () {
      openConversation(userCache[conv.user_id]);
    });

    conversationsList.appendChild(item);
  });
}

// ============================================================
// OPENING CONVERSATIONS & LOADING MESSAGES
// ============================================================

async function openConversation(user) {
  activeConversation = user;

  chatHeaderName.textContent = user.display_name;
  encryptionBadge.style.display = "block";
  noChatSelected.style.display = "none";
  messageInputContainer.style.display = "block";
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();

  document.querySelectorAll(".conversation-item").forEach(function (item) {
    item.classList.remove("active");
  });

  await loadMessageHistory(user.id);

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function loadMessageHistory(userId) {
  try {
    const url =
      getUrl(CONFIG.ENDPOINTS.CONVERSATIONS) +
      "/" +
      userId +
      "/messages?limit=50";

    const response = await fetch(url, {
      headers: {
        Authorization: "Bearer " + session.accessToken,
      },
    });

    if (!response.ok) throw new Error("Failed to load messages");

    const messages = await response.json();

    messagesContainer.innerHTML = "";
    messages.reverse();

    for (const message of messages) {
      await displayMessage(message);
    }
  } catch (error) {
    console.error("Error loading messages:", error);
  }
}

// ============================================================
// DISPLAYING MESSAGES (DECRYPTION)
// ============================================================

async function displayMessage(message) {
  try {
    let payloadToDecrypt;

    if (message.from_user_id === session.currentUser.id) {
      payloadToDecrypt = {
        ciphertext: message.payload.ciphertext,
        iv: message.payload.iv,
        encryptedKey: message.payload.encryptedKeyForSelf,
      };
    } else {
      payloadToDecrypt = {
        ciphertext: message.payload.ciphertext,
        iv: message.payload.iv,
        encryptedKey: message.payload.encryptedKey,
      };
    }

    const plaintext = await decryptMessage(
      session.privateKey,
      payloadToDecrypt,
    );

    const messageDiv = document.createElement("div");
    messageDiv.className =
      "message " +
      (message.from_user_id === session.currentUser.id ? "sent" : "received");
    messageDiv.innerHTML = `<div class="message-bubble">${escapeHTML(plaintext)}</div>`;

    messagesContainer.appendChild(messageDiv);
  } catch (error) {
    console.error("Failed to decrypt message:", error);
    const messageDiv = document.createElement("div");
    messageDiv.className = "message received";
    messageDiv.innerHTML = `<div class="message-bubble" style="color: #E74C3C;">🔒 Unable to decrypt message</div>`;
    messagesContainer.appendChild(messageDiv);
  }
}

// ============================================================
// SENDING MESSAGES (ENCRYPTION)
// ============================================================

messageForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  if (!activeConversation) return;

  const plaintext = messageInput.value.trim();
  if (!plaintext) return;

  messageInput.value = "";

  try {
    const recipientPublicKey = await fetchUserPublicKey(activeConversation.id);
    const aesKey = await generateAESKey();
    const { ciphertext, iv } = await encryptMessage(aesKey, plaintext);

    const encryptedKeyBytes = await encryptAESKeyWithRSA(
      aesKey,
      recipientPublicKey,
    );
    const encryptedKey = arrayBufferToBase64(encryptedKeyBytes);

    const myPublicKey = session.currentUser.public_key;
    const encryptedKeyForSelfBytes = await encryptAESKeyWithRSA(
      aesKey,
      myPublicKey,
    );
    const encryptedKeyForSelf = arrayBufferToBase64(encryptedKeyForSelfBytes);

    const payload = {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv),
      encryptedKey: encryptedKey,
      encryptedKeyForSelf: encryptedKeyForSelf,
    };

    sendMessageViaWebSocket(activeConversation.id, payload);

    const messageDiv = document.createElement("div");
    messageDiv.className = "message sent";
    messageDiv.innerHTML = `<div class="message-bubble">${escapeHTML(plaintext)}</div>`;
    messagesContainer.appendChild(messageDiv);

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (error) {
    console.error("Failed to send message:", error);
    alert("Failed to send message: " + error.message);
    messageInput.value = plaintext;
  }
});

function handleIncomingMessage(data) {
  if (activeConversation && data.from_user_id === activeConversation.id) {
    displayMessage(data);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  loadConversations();
}

// ============================================================
// HELPERS
// ============================================================

async function fetchUserPublicKey(userId) {
  const url =
    getUrl(CONFIG.ENDPOINTS.USER_PUBLIC_KEY) + "/" + userId + "/public-key";

  const response = await fetch(url, {
    headers: {
      Authorization: "Bearer " + session.accessToken,
    },
  });

  if (!response.ok) throw new Error("Failed to fetch user public key");

  const data = await response.json();
  return data.public_key;
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// LOGOUT
// ============================================================

logoutBtn.addEventListener("click", function () {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }

  session.accessToken = null;
  session.refreshToken = null;
  session.currentUser = null;
  session.privateKey = null;
  activeConversation = null;

  messagesContainer.innerHTML = "";
  conversationsList.innerHTML = "";
  chatHeaderName.textContent = "Select a conversation";
  encryptionBadge.style.display = "none";
  noChatSelected.style.display = "flex";
  messageInputContainer.style.display = "none";
  messageInput.disabled = true;
  sendBtn.disabled = true;

  showScreen("auth");
});
