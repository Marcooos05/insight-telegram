const axios = require("axios");
const CONFIRMATION_DELETE = "CONFIRMATION_DELETE"

async function handleDelete(chatId, messageText, userStates, API_URL) {
    console.info("userState:" + userStates[chatId])
    if (messageText === "/delete") {
        await axios.post(`${API_URL}/sendMessage`, {
                    chat_id: chatId,
                    text: "<b>Would you like to delete your record in our database?</b>😭",
                    parse_mode: "HTML", // Enables bold and clean formatting
                    reply_markup: {
                        keyboard: [
                            [{text: "Yes"}],
                            [{text: "No"}],
                        ],
                        one_time_keyboard: true, // The keyboard disappears after selection
                        resize_keyboard: true // Resizes the keyboard for a better UI
                    }
                });
      userStates[chatId].delete = true;
    }
    else if (!userStates[chatId]) {
        // Invalid as not logged in
        await axios.post(`${API_URL}/sendMessage`, {
                    chat_id: chatId,
                    text: "<b>Your request to delete your record has been denied as you have no entry in our database</b>😱",
                    parse_mode: "HTML", // Enables bold and clean formatting
                });
    }
    else {
        try {
            delete userStates[chatId];
            await axios.post(`${API_URL}/sendMessage`, {
                chat_id: chatId,
                text: "🎉 <b>You have deleted your entry from the database. Please do /start " +
                    "to re-register now. </b> 😊",
                parse_mode: "HTML" // Enables bold and clean formatting
            });

        }
        catch (error) {
            console.error('Error trying to delete entry from database:', error.message);
        }
    }
}

module.exports = { CONFIRMATION_DELETE, handleDelete };