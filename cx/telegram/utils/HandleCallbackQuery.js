const axios = require('axios');

async function handleCallbackQuery(chatId, callbackData, url, callbackQueryId) {
  switch (callbackData) {
    case "events_0":
      await axios.post(`${url}/sendMessage`, {
        chat_id: chatId,
        text: "You selected Option 1!",
      });
      break;

    case "events_11":
      await axios.post(`${url}/sendMessage`, {
        chat_id: chatId,
        text: "You selected Option 2!",
      });
      break;

    default:
      await axios.post(`${url}/sendMessage`, {
        chat_id: chatId,
        text: "Invalid option selected.",
      });
      break;
  }
  await axios.post(`${url}/answerCallbackQuery`, {
    callback_query_id: callbackQueryId,
  });
}

module.exports = handleCallbackQuery;