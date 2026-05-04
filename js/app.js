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

// --- Error Message Elements ---
// Login errors
const loginUsernameError = document.getElementById("login-username-error");
const loginPasswordError = document.getElementById("login-password-error");

// Register errors
const registerUsernameError = document.getElementById(
  "register-username-error",
);
const registerDisplayNameError = document.getElementById(
  "register-display-name-error",
);
const registerPasswordError = document.getElementById(
  "register-password-error",
);

// ============================================================
// Toggle between Login and Register forms
// ============================================================
showRegisterLink.addEventListener("click", function (event) {
  event.preventDefault(); // Stop the link from trying to navigate to "#"
  clearAllErrors(loginFields); // Clear any login errors
  clearAllErrors(registerFields); // Clear any register errors
  loginForm.classList.add("hidden");
  registerForm.classList.remove("hidden");
  loginForm.reset(); // reset the form fields
});

showLoginLink.addEventListener("click", function (event) {
  event.preventDefault();
  clearAllErrors(loginFields);
  clearAllErrors(registerFields);
  registerForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
  registerForm.reset();
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
// VALIDATION HELPERS
// ============================================================

/**
 * Shows an error message below a specific input field.
 *
 * @param {HTMLElement} inputElement - The input that has the error
 * @param {HTMLElement} errorElement - The span where the message appears
 * @param {string} message - The error message to display
 */
function showInputError(inputElement, errorElement, message) {
  inputElement.classList.add("error");
  errorElement.textContent = message;
}

/**
 * Clears an error message from a specific input field.
 *
 * @param {HTMLElement} inputElement - The input to clear the error from
 * @param {HTMLElement} errorElement - The error span to clear
 */
function clearInputError(inputElement, errorElement) {
  inputElement.classList.remove("error");
  errorElement.textContent = "";
}

/**
 * Clears ALL error messages in a form.
 * Call this when switching forms or before re-validating.
 *
 * @param {Array} fields - Array of {input, error} objects
 */
function clearAllErrors(fields) {
  fields.forEach(function (field) {
    clearInputError(field.input, field.error);
  });
}

// ============================================================
// Handle login form submission
// ============================================================

// Define the login fields for easy clearing
const loginFields = [
  { input: loginUsernameInput, error: loginUsernameError },
  { input: loginPasswordInput, error: loginPasswordError },
];

// Clear errors when the user starts typing
loginUsernameInput.addEventListener("input", function () {
  clearInputError(loginUsernameInput, loginUsernameError);
});

loginPasswordInput.addEventListener("input", function () {
  clearInputError(loginPasswordInput, loginPasswordError);
});

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  // Clear all previous errors first
  clearAllErrors(loginFields);

  // Get the values the user typed
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  // --- Validation checks ---
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

  // If any validation failed, stop here
  if (hasError) {
    return;
  }

  // --- Proceed with login ---
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
    // Show server errors as inline errors when possible
    const errorMessage = error.message.toLowerCase();
    if (errorMessage.includes("username") || errorMessage.includes("user")) {
      showInputError(loginUsernameInput, loginUsernameError, error.message);
    } else if (
      errorMessage.includes("password") ||
      errorMessage.includes("credential")
    ) {
      showInputError(loginPasswordInput, loginPasswordError, error.message);
    } else {
      // Generic error — show it on the password field
      showInputError(loginPasswordInput, loginPasswordError, error.message);
    }
    // Reset the button back to normal

    submitButton.textContent = originalButtonText;
    submitButton.disabled = false;
  }
});

// ============================================================
// Handle registration form submission
// ============================================================

// ============================================================
// REGISTER FORM HANDLER (with proper validation)
// ============================================================

// Define the register fields for easy clearing
const registerFields = [
  { input: registerUsernameInput, error: registerUsernameError },
  { input: registerDisplayNameInput, error: registerDisplayNameError },
  { input: registerPasswordInput, error: registerPasswordError },
];

// Clear errors when the user starts typing
registerUsernameInput.addEventListener("input", function () {
  clearInputError(registerUsernameInput, registerUsernameError);
});

registerDisplayNameInput.addEventListener("input", function () {
  clearInputError(registerDisplayNameInput, registerDisplayNameError);
});

registerPasswordInput.addEventListener("input", function () {
  clearInputError(registerPasswordInput, registerPasswordError);
});

registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  // Clear all previous errors
  clearAllErrors(registerFields);

  // Get the values
  const username = registerUsernameInput.value.trim();
  const displayName = registerDisplayNameInput.value.trim();
  const password = registerPasswordInput.value;

  // --- Validation checks ---
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

  // If any validation failed, stop here
  if (hasError) {
    return;
  }

  // --- Proceed with registration ---
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
    // Show server errors as inline errors
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
      // Generic error
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
