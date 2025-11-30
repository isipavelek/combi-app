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
    // Trigger redeploy - Debugging chat notifications
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

/**
 * Triggered when a user updates their trip schedule in 'frecuencia'.
 * Checks for last-minute changes (07:00 - 08:30 AM) for the CURRENT day's Morning trip (Ida).
 */
exports.onTripUpdate = functions.firestore
  .document('frecuencia/{email}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userName = afterData.nombre || 'Un pasajero';
    const email = context.params.email;

    // 1. Get Current Time in Argentina (UTC-3)
    const now = new Date();
    // Adjust to Argentina Time (UTC-3)
    // Note: This simple offset works for standard time. For strict DST handling, use 'moment-timezone' or similar.
    // But Argentina doesn't observe DST currently.
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const arTime = new Date(utcTime - (3 * 60 * 60 * 1000));

    const hours = arTime.getHours();
    const minutes = arTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 07:00 = 420 min, 08:30 = 510 min
    const START_MIN = 7 * 60;
    const END_MIN = 8 * 60 + 30;

    // Only proceed if within the time window
    if (totalMinutes < START_MIN || totalMinutes > END_MIN) {
      console.log(`Update outside last-minute window (${hours}:${minutes}). Ignoring.`);
      return null;
    }

    // 2. Determine Current Day Name (Lunes, Martes, etc.)
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const currentDayName = days[arTime.getDay()];

    if (currentDayName === 'Domingo' || currentDayName === 'Sábado') {
      return null; // Ignore weekends
    }

    // 3. Check for changes in TODAY's Ida trip
    const beforeDay = beforeData.dias?.[currentDayName]?.ida || {};
    const afterDay = afterData.dias?.[currentDayName]?.ida || {};

    // Check if "usar" (going/not going) changed
    // undefined/null means "no info", true means "going", false means "not going"
    
    let messageBody = '';

    // Case A: Changed from Going (true) to Not Going (false)
    if (beforeDay.usar === true && afterDay.usar === false) {
      messageBody = `🚫 Cambio de último momento: ${userName} YA NO viaja hoy.`;
    }
    // Case B: Changed from Not Going/Unknown to Going (true)
    else if (beforeDay.usar !== true && afterDay.usar === true) {
      const parada = afterDay.parada || 'su parada habitual';
      messageBody = `✅ Cambio de último momento: ${userName} SE SUMA hoy (Sube en ${parada}).`;
    }
    // Case C: Changed Parada while still Going
    else if (beforeDay.usar === true && afterDay.usar === true && beforeDay.parada !== afterDay.parada) {
      messageBody = `🚏 Cambio de último momento: ${userName} cambia parada a ${afterDay.parada}.`;
    }

    if (!messageBody) {
      console.log("No significant change detected for today's Ida trip.");
      return null;
    }

    console.log(`Sending last-minute notification: ${messageBody}`);

    try {
      // 4. Send Broadcast Notification (excluding the user who made the change)
      const usersSnapshot = await admin.firestore().collection("users").get();
      const tokens = [];

      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.fcmToken && userData.email !== email) {
          tokens.push(userData.fcmToken);
        }
      });

      if (tokens.length === 0) return null;

      const message = {
        notification: {
          title: '📢 Aviso de CombiApp',
          body: messageBody,
        },
        tokens: tokens,
      };

      await admin.messaging().sendEachForMulticast(message);
      return { success: true };

    } catch (error) {
      console.error("Error sending last-minute notification:", error);
      return null;
    }
  });
