const { sendEventsList } = require("./sendEventsList");
const axios = require("axios");
const { END_FLOW} = require("../flows/eventpass");
const { SELECT_EVENT } = require("../flows/planning");
const {db} = require("./firebaseAdmin");

const selectedEvents = {}; // ✅ Store user selections

async function handleEventChoice(chatId, messageText, API_URL, userState) {
  try {
    console.log(`📌 User Selected: ${messageText}`);

    // ✅ Ensure selectedEvents exists
    if (!selectedEvents[chatId]) {
      selectedEvents[chatId] = new Set();
    }

    // ✅ If user is in SELECT_INTEREST, send event list first (if not already displayed)
    if (userState[chatId].state === SELECT_EVENT && !userState[chatId].eventListShown) {
      userState[chatId].state = SELECT_EVENT
      userState[chatId].currentPage = 0 // ✅ Track pagination & state
      console.log(`📌 First-time event selection. Sending event list.`);
      userState[chatId].eventListShown = true; // ✅ Mark as displayed
      await sendEventsList(chatId, API_URL, userState[chatId].currentPage, 6);
      return;
    }

    // ✅ Handle Pagination
    if (messageText === "⬅️ Previous") {
      userState[chatId].currentPage = Math.max(0, userState[chatId].currentPage - 1);
      await sendEventsList(chatId, API_URL, userState[chatId].currentPage, 6);
      return;
    }
    if (messageText === "Next ➡️") {
      userState[chatId].currentPage += 1;
      await sendEventsList(chatId, API_URL, userState[chatId].currentPage, 6);
      return;
    }

    // ✅ Handle "Finish Selection"
    if (messageText === "✅ Finish Selection") {
      if (selectedEvents[chatId].size === 0) {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "⚠️ You haven't selected any events yet. Please choose at least one before finishing.",
          parse_mode: "HTML",
        });
        return;
      }

      // ✅ Send Final Confirmation Message
      const selectedEventNames = Array.from(selectedEvents[chatId]);

      // ✅ Save all reminders in Firestore
      const batch = db.batch();
      const remindersRef = db.collection("reminders");

      selectedEventNames.forEach(eventName => {
        const docRef = remindersRef.doc(`${chatId}_${eventName}`);
        batch.set(docRef, {
          chatId,
          event: eventName,
          timestamp: new Date(), // Change this if you have event-specific timestamps
          scheduledAt: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), // Example: Schedule for 24 hours later
        }, { merge: true });
      });

      await batch.commit(); // ✅ Save all reminders in batch

      // ✅ Send Confirmation Message
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `🎉 Thank you for choosing your events!\n\n📅 You have registered for:\n\n${selectedEventNames.map(e => `- ${e}`).join("\n")}`,
        parse_mode: "HTML",
        reply_markup: {
          remove_keyboard: true, // ✅ This hides the keyboard
        },
      });

      // ✅ Clear selection after finishing
      delete selectedEvents[chatId];
      userState[chatId].state = END_FLOW;

      // ✅ Schedule Messages (This requires a scheduler function)
      // scheduleMessagesForUser(chatId, selectedEventNames);

      return;
    }

    // ✅ Handle Event Selection (Auto-Reminder)

    if (selectedEvents[chatId].has(messageText)) {
      selectedEvents[chatId].delete(messageText);
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `❌ Removed reminder for "${messageText}".`,
        parse_mode: "HTML",
      });
    } else {
      selectedEvents[chatId].add(messageText);
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `⏰ Reminder set for "${messageText}".`,
        parse_mode: "HTML",
      });
    }

    // ✅ Resend Event List (So User Can Continue Selecting)
    await sendEventsList(chatId, API_URL, userState[chatId].currentPage, 6);

  } catch (error) {
    console.error("❌ Error handling user response:", error.message);
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: "⚠️ An error occurred. Please try again.",
      parse_mode: "HTML",
    });
  }
}

module.exports = { handleEventChoice };