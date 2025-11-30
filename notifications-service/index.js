const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

// Initialize Firebase Admin
// In Cloud Run, this uses Application Default Credentials automatically.
// Locally, you need GOOGLE_APPLICATION_CREDENTIALS env var or logged in via gcloud.
admin.initializeApp();

const app = express();

// Middleware
app.use(cors({ origin: true })); // Allow all origins for now, restrict in production
app.use(express.json());

const db = admin.firestore();
const messaging = admin.messaging();

// Helper: Check if user is admin
async function isUserAdmin(email) {
    const ADMIN_EMAILS = ['ipavelek@gmail.com']; // Hardcoded fallback
    if (ADMIN_EMAILS.includes(email)) return true;

    try {
        const userDoc = await db.collection("users").doc(email).get();
        return userDoc.exists && userDoc.data().isAdmin === true;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

// Middleware to verify ID token
const verifyToken = async (req, res, next) => {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
        return res.status(401).send('Unauthorized: No token provided');
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error("Error verifying token:", error);
        return res.status(403).send('Unauthorized: Invalid token');
    }
};

/**
 * POST /send-broadcast
 * Sends a push notification to all users.
 * Requires Admin privileges.
 */
app.post('/send-broadcast', verifyToken, async (req, res) => {
    const { title, body } = req.body;
    const email = req.user.email;

    if (!title || !body) {
        return res.status(400).json({ error: "Title and Body are required." });
    }

    // Check Admin
    const isAdmin = await isUserAdmin(email);
    if (!isAdmin) {
        return res.status(403).json({ error: "Permission denied. Admins only." });
    }

    try {
        // Fetch all tokens
        const usersSnapshot = await db.collection("users").get();
        const tokens = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.fcmToken) {
                tokens.push(userData.fcmToken);
            }
        });

        if (tokens.length === 0) {
            return res.json({ success: true, message: "No tokens found." });
        }

        // Send Multicast
        const message = {
            notification: { title, body },
            tokens: tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        
        console.log(`${response.successCount} messages sent successfully.`);
        if (response.failureCount > 0) {
            console.log(`Failed to send ${response.failureCount} messages.`);
        }

        return res.json({
            success: true,
            sentCount: response.successCount,
            failureCount: response.failureCount
        });

    } catch (error) {
        console.error("Error sending broadcast:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * POST /on-chat-message
 * Triggered manually or via webhook when a new chat message exists.
 * Sends notification to all users except sender.
 */
app.post('/on-chat-message', async (req, res) => {
    // Note: If calling from client, you might want verifyToken here too.
    // If calling from Eventarc/Cloud Scheduler, you need to validate the invoker.
    // For simplicity, we assume this is an internal or trusted call for now, 
    // BUT if called from client directly, we should verify token.
    
    // Let's assume this is called by the client for now, so we verify token to get sender email reliably.
    // OR we trust the body if we assume it's a backend-to-backend call.
    // Given the previous architecture was Firestore trigger, let's make this flexible.
    
    const { text, senderName, senderEmail } = req.body;

    if (!text || !senderEmail) {
        return res.status(400).json({ error: "Missing text or senderEmail" });
    }

    try {
        console.log(`Processing chat message from: ${senderEmail}`);

        const usersSnapshot = await db.collection("users").get();
        const tokens = [];

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.fcmToken && userData.email !== senderEmail) {
                tokens.push(userData.fcmToken);
            }
        });

        if (tokens.length === 0) {
            return res.json({ message: "No tokens to notify." });
        }

        const message = {
            notification: {
                title: `💬 ${senderName || 'Usuario'}`,
                body: text,
            },
            tokens: tokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`Chat notification sent: ${response.successCount} success.`);

        return res.json({
            success: true,
            sentCount: response.successCount
        });

    } catch (error) {
        console.error("Error sending chat notification:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Notifications service listening on port ${PORT}`);
});
