const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const { sleep } = require("../utils/Sleep");
const { END_FLOW } = require("./eventpass");
const { db } = require("../utils/firebaseAdmin");

const planning_states = {
  PLANNING: "PLANNING",
  SELECT_INTEREST: "SELECT_INTEREST",
};

const PLANNING_START = planning_states.PLANNING;

async function handlePlanning(chatId, messageText, userStates, API_URL) {
  try {
    console.info("userState:" + userStates[chatId]);
    const user = userStates[chatId];
    switch (user.state) {
      case planning_states.PLANNING: // Step 2: Get the choice of pillar
          console.log("Planning response path")
        try {
          if (!["Later", "Yes"].includes(messageText)) {
            await axios.post(`${API_URL}/sendMessage`, {
              chat_id: chatId,
              text: "Please select one of the provided options.",
              parse_mode: "HTML",
            });
            return;
          }
          // User selects "Later"
          else if (messageText.toLowerCase() === "later") {
            await axios.post(`${API_URL}/sendMessage`, {
              chat_id: chatId,
              text: "No problem! Let me know anytime you need me!",
              parse_mode: "HTML",
            });
            user.state = END_FLOW;
            return;
          }
          // User selects "Yes"
          else {
            await axios.post(`${API_URL}/sendMessage`, {
              chat_id: chatId,
              text: "✨Now, I will help you to plan your schedule. Do you have an idea of what events you want to go today? I'll wait for you to decide :) ✨",
              parse_mode: "HTML",
              reply_markup: {
                keyboard: [[{ text: "Yes" }], [{ text: "No" }]],
                one_time_keyboard: true, // The keyboard disappears after selection
                resize_keyboard: true, // Resizes the keyboard for a better UI
              },
            });

            user.state = planning_states.SELECT_INTEREST;
          }
        } catch (error) {
          console.error("❌ Error handling PLANNING state:", error.message);
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "⚠️ An error occurred while processing your request. Please try again later.",
            parse_mode: "HTML",
          });
        }
        break;

      case planning_states.SELECT_INTEREST: // Questionnaire or event selection
        try {
          if (messageText.toLowerCase() === "yes") {
            try {
              // Reference the document for today's events
              const eventsDoc = db.collection("events").doc("24 Feb");
              const docSnapshot = await eventsDoc.get();

              if (docSnapshot.exists) {
                const eventsDict = docSnapshot.data();
                const inlineKeyboard = Object.keys(eventsDict).map((eventName, index) => [
                  {
                    text: eventName,
                    callback_data: `events_${index}`,
                  },
                ]);

                const maxButtonsPerPage = 10;
                const pages = [];
                for (let i = 0; i < inlineKeyboard.length; i += maxButtonsPerPage) {
                  pages.push(inlineKeyboard.slice(i, i + maxButtonsPerPage));
                }

                // Send paginated event messages
                for (const page of pages) {
                  await axios.post(`${API_URL}/sendMessage`, {
                    chat_id: chatId,
                    text: "Which events are you interested in attending today? 🗓️",
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: page,
                    },
                  });
                }
              } else {
                await axios.post(`${API_URL}/sendMessage`, {
                  chat_id: chatId,
                  text: "There were no events found 🗓️",
                  parse_mode: "HTML",
                });
              }
            } catch (error) {
              console.error("❌ Error fetching or sending events:", error.message);
              await axios.post(`${API_URL}/sendMessage`, {
                chat_id: chatId,
                text: "⚠️ An error occurred while fetching the events. Please try again later.",
                parse_mode: "HTML",
              });
            }
          } else {
            // Send questionnaire
            await axios.post(`${API_URL}/sendMessage`, {
              chat_id: chatId,
              text: "Interests Poll",
              parse_mode: "HTML",
            });
          }

          user.state = END_FLOW; // Temporary
        } catch (error) {
          console.error("❌ Error handling SELECT_INTEREST state:", error.message);
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "⚠️ An error occurred while processing your selection. Please try again later.",
            parse_mode: "HTML",
          });
        }
        break;

      default:
        console.error(`❌ Error: Unknown user state "${user.state}"`);
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "⚠️ Something went wrong. Please try again later.",
          parse_mode: "HTML",
        });
        break;
    }
  } catch (error) {
    console.error("❌ Error in handlePlanning function:", error.message);
    await axios.post(`${API_URL}/sendMessage`, {
      chat_id: chatId,
      text: "⚠️ A critical error occurred. Please try again later.",
      parse_mode: "HTML",
    });
  }
}

module.exports = { handlePlanning, PLANNING_START };