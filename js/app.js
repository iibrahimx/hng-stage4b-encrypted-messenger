/**
 * app.js — The Conductor of Our Orchestra
 *
 * This file coordinates everything:
 *   - Listens for button clicks and form submissions
 *   - Calls auth.js functions when users log in or register
 *   - Updates the UI based on application state
 *   - Manages which screen and form are visible
 */

// ============================================================
// Grab references to all HTML elements needed
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

// ============================================================
// Toggle between Login and Register forms
// ============================================================

showRegisterLink.addEventListener("click", function (event) {
  event.preventDefault(); // Stop the link from trying to navigate to "#"
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
});

showLoginLink.addEventListener("click", function (event) {
  event.preventDefault(); // Stop the link from trying to navigate to "#"
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

// ============================================================
// Screen switching utility function
// ============================================================

/**
 * Switches the visible screen.
 *
 * @param {string} screenToShow - Either 'auth' or 'chat'
 */
function showScreen(screenToShow) {
  if (screenToShow === "chat") {
    authScreen.classList.remove("active");
    chatScreen.classList.add("active");
  } else {
    // Default: show auth screen
    chatScreen.classList.remove("active");
    authScreen.classList.add("active");
  }
}

// ============================================================
// Update sidebar with user info
// ============================================================

/**
 * Updates the sidebar with the logged-in user's information.
 * @param {object} user - The user object from the server
 */
function updateSidebarUser(user) {
  // Show the first letter of the display name as the avatar
  const initial = user.display_name.charAt(0).toUpperCase();
  document.getElementById("current-user-avatar").textContent = initial;

  // Show the display name
  document.getElementById("current-user-name").textContent = user.display_name;
}

// ============================================================
// Handle login form submission
// ============================================================

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  // Get the values the user typed
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  if (!username || !password) {
    alert("Please enter both username and password.");
    return;
  }

  const submitButton = loginForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  submitButton.textContent = "Logging in...";
  submitButton.disabled = true;

  try {
    // Call the loginUser function from auth.js
    // This sends the credentials to the server, gets back the keys,
    // unwraps the private key, and saves everything to the session
    const user = await loginUser(username, password);

    updateSidebarUser(user); // Put the user's info in the sidebar on success

    // Switch to the chat screen
    showScreen("chat");

    // Clear the form fields
    loginForm.reset();
  } catch (error) {
    alert("Login failed: " + error.message);

    // Reset the button back to normal
    submitButton.textContent = originalButtonText;
    submitButton.disabled = false;
  }
});

// ============================================================
// Handle registration form submission
// ============================================================

registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const username = registerUsernameInput.value.trim();
  const displayName = registerDisplayNameInput.value.trim();
  const password = registerPasswordInput.value;

  if (!username || !displayName || !password) {
    alert("Please fill in all fields.");
    return;
  }

  if (password.length < 8) {
    alert("Password must be at least 8 characters long.");
    return;
  }

  const submitButton = registerForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  submitButton.textContent = "Creating Account...";
  submitButton.disabled = true;

  try {
    // Call registerUser from auth.js
    // This generates keys, wraps the private key, and sends everything
    const user = await registerUser(username, displayName, password);

    updateSidebarUser(user);
    showScreen("chat");
    registerForm.reset();
  } catch (error) {
    alert("Registration failed: " + error.message);
    submitButton.textContent = originalButtonText;
    submitButton.disabled = false;
  }
});
