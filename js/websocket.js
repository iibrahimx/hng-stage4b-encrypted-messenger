// ============================================================
// CONNECTION STATE
// ============================================================

// Holds the active WebSocket connection (null when not connected)
let wsConnection = null;

// ============================================================
// EVENT LISTENER SYSTEM
// Other parts of the app can "subscribe" to WebSocket events
// ============================================================

// An object that stores arrays of callback functions for each event type
const eventListeners = {
  "message.receive": [],
  "user.online": [],
  "user.offline": [],
  error: [],
};

// ============================================================
// CONNECTION MANAGEMENT
// ============================================================

function connectWebSocket() {
  return new Promise(function (resolve, reject) {
    // Build the WebSocket URL with our access token
    const wsUrl = "wss://whisperbox.koyeb.app/ws?token=" + session.accessToken;

    // Create the connection
    const ws = new WebSocket(wsUrl);

    // This fires when the connection opens successfully
    ws.onopen = function () {
      console.log("WebSocket connected");
      wsConnection = ws;
      resolve(ws);
    };

    // --- Message received ---
    ws.onmessage = function (event) {
      const data = JSON.parse(event.data);

      const eventType = data.event;
      if (eventListeners[eventType]) {
        eventListeners[eventType].forEach(function (callback) {
          callback(data);
        });
      }
    };

    ws.onclose = function () {
      console.log("WebSocket disconnected");
      wsConnection = null;
    };

    ws.onerror = function (error) {
      console.error("WebSocket error:", error);
      reject(error);
    };
  });
}

// ============================================================
// EVENT SUBSCRIPTION
// ============================================================

function onWebSocketEvent(eventType, callback) {
  if (!eventListeners[eventType]) {
    eventListeners[eventType] = [];
  }

  eventListeners[eventType].push(callback);
}

// ============================================================
// SENDING MESSAGES
// ============================================================

function sendMessageViaWebSocket(recipientId, payload) {
  if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket is not connected. Please try again.");
  }

  const message = {
    event: "message.send",
    to: recipientId,
    payload: {
      ciphertext: payload.ciphertext,
      iv: payload.iv,
      encryptedKey: payload.encryptedKey,
      encryptedKeyForSelf: payload.encryptedKeyForSelf,
    },
  };

  wsConnection.send(JSON.stringify(message));
}
