const axios = require('axios');
const {db} = require("../utils/firebaseAdmin");

async function handleCallbackQuery(chatId, callbackData, url, callbackQueryId) {
  const eventIndex = parseInt(callbackData.split("_")[1]); // Extract event index
  // Reference the document for today's events
  const eventsDoc = db.collection("events").doc("24 Feb");
  const docSnapshot = await eventsDoc.get();
  const eventsDict = docSnapshot.data();
  const selectedEvent = Object.keys(eventsDict)[eventIndex]; // Get event name
  if (selectedEvent) {
    await axios.post(`${url}/sendMessage`, {
      chat_id: chatId,
      text: `You selected: <b>${selectedEvent}</b> ✅`,
      parse_mode: "HTML",
    });
  }
  await axios.post(`${url}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
  });
}

module.exports = handleCallbackQuery;