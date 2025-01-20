const admin = require("firebase-admin");

// Ensure Firebase is initialized only once
if (!admin.apps.length) {
  const serviceAccount = require("../firestore-key.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Export Firestore instance
const db = admin.firestore();

module.exports = { db, admin };