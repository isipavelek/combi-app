const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Sends a push notification to all users with a registered FCM token.
 * Callable from the client (Admin Panel).
 * 
 * @param {object} data - { title: string, body: string }
 * @param {object} context - Auth context
 */
exports.sendBroadcastNotification = functions.https.onCall(async (data, context) => {
  // 1. Security Check: Ensure user is authenticated and is an Admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  // Fetch user to check admin status (optional but recommended)
  const userDoc = await admin.firestore().collection("users").doc(context.auth.token.email).get();
  if (!userDoc.exists || !userDoc.data().isAdmin) {
    // Also check hardcoded list if needed, but Firestore is better source of truth now
    const ADMIN_EMAILS = ['ipavelek@gmail.com']; // Fallback
    if (!ADMIN_EMAILS.includes(context.auth.token.email)) {
       throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can send notifications."
      );
    }
  }

  const { title, body } = data;
  if (!title || !body) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Title and Body are required."
    );
  }

  try {
    // 2. Fetch all tokens
    const usersSnapshot = await admin.firestore().collection("users").get();
    const tokens = [];
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken);
      }
    });

    if (tokens.length === 0) {
      return { success: true, message: "No tokens found." };
    }

    // 3. Send Multicast Message (FCM V1)
    // Note: sendEachForMulticast is the modern way, but limits to 500 tokens per batch.
    // For this app, it's likely fine. If scaling, need to batch.
    const message = {
      notification: {
        title: title,
        body: body,
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(response.successCount + " messages were sent successfully");
    
    // Cleanup invalid tokens (optional but good practice)
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      console.log('List of tokens that caused failures: ' + failedTokens);
    }

    return { 
      success: true, 
      sentCount: response.successCount, 
      failureCount: response.failureCount 
    };

  } catch (error) {
    console.error("Error sending notifications:", error);
    throw new functions.https.HttpsError("internal", "Error sending notifications.");
  }
});

/**
 * Triggered when a new document is created in 'chat_messages'.
 * Sends a push notification to all users except the sender.
 */
exports.onNewChatMessage = functions.firestore
  .document('chat_messages/{messageId}')
  .onCreate(async (snap, context) => {
    const newValue = snap.data();
    if (!newValue) {
      console.log("No data found in snapshot (likely a console test).");
      return null;
    }
    const text = newValue.text;
    const senderName = newValue.senderName || newValue.sender || 'Usuario';
    const senderEmail = newValue.senderEmail || '';

    // Avoid infinite loops or self-notifications if possible (though client should handle)
    // We will filter out the sender's token.

    try {
      console.log(`Processing message from: ${senderEmail}`);

      // 1. Fetch all tokens
      const usersSnapshot = await admin.firestore().collection("users").get();
      const tokens = [];

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmToken) {
            if (userData.email !== senderEmail) {
                tokens.push(userData.fcmToken);
            } else {
                console.log("Skipping sender token:", userData.email);
            }
        }
      });

      console.log(`Found ${tokens.length} tokens to notify.`);

      if (tokens.length === 0) {
        console.log("No tokens found to notify.");
        return null;
      }

      // 2. Send Multicast Message
      const message = {
        notification: {
          title: `💬 ${senderName}`,
          body: text,
        },
        tokens: tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Chat notification sent: ${response.successCount} success, ${response.failureCount} failed.`);
      
      if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                  console.error(`Failure sending to token at index ${idx}:`, resp.error);
              }
          });
      }
      
      return null;

    } catch (error) {
      console.error("Error sending chat notification:", error);
      return null;
    }
  });
