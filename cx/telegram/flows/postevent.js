require("dotenv").config();
const config = require("../config");
const axios = require("axios");

const post_event_states = {
  SELECT_PILLARS: "SELECT_PILLARS",
  SEND_SURVEY: "SEND_SURVEY",
};

async function handlePostEvent(chatId, messageText, userStates, API_URL) {
  console.info("userState:" + userStates[chatId]);
  if (!userStates[chatId] || !userStates[chatId].postEventState) {
    userStates[chatId] = userStates[chatId] || {};
    userStates[chatId].postEventState = post_event_states.SELECT_PILLARS;
    userStates[chatId].data = userStates[chatId].data || {};
    userStates[chatId].data.postEventPillars = [];
  }
  const user = userStates[chatId];
  switch (userStates[chatId].postEventState) {
    case post_event_states.SELECT_PILLARS:
      if (!(messageText === "Finish ✅")) {
        if (
          ![
            "Architecture and Sustainable Design (ASD)",
            "Computer Science and Design (CSD)",
            "Design and Artificial Intelligence (DAI)",
            "Engineering Product Development (EPD)",
            "Engineering Systems and Design (ESD)",
            "SUTD Admissions Office",
          ].includes(messageText)
        ) {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "Please select one of the provided options.",
            parse_mode: "HTML",
          });
          return;
        }
        user.data.postEventPillars.push(messageText);

        const pillars = [
          [{ text: "Architecture and Sustainable Design (ASD)" }],
          [{ text: "Computer Science and Design (CSD)" }],
          [{ text: "Design and Artificial Intelligence (DAI)" }],
          [{ text: "Engineering Product Development (EPD)" }],
          [{ text: "Engineering Systems and Design (ESD)" }],
          [{ text: "SUTD Admissions Office" }],
          [{ text: "Finish ✅" }],
        ];

        const filteredPillars = pillars.filter(
          (item) => !user.data.postEventPillars.includes(item[0].text)
        );

        const selectedPillars =
          "\nSelected: " + user.data.postEventPillars.join(", ") + "\n";

        console.log("Filtered Pillars: ", filteredPillars);

        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: `Which SUTD booth would you like to learn more about? A representative from your selected department(s) will contact you soon to share more information! ✨\n${selectedPillars}\nSelect 'Finish ✅' when you are done.`,
          parse_mode: "HTML",
          reply_markup: {
            keyboard: filteredPillars,
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        });
        break;
      } else {
        userStates[chatId].postEventState = post_event_states.SEND_SURVEY;
      }

    case post_event_states.SEND_SURVEY:
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "Thank you for your response! The respective pillars will reach out to you soon. Have a great day!",
        parse_mode: "HTML",
      });

      console.log("User has selected pillars: ", user.data.postEventPillars);
      //TODO save pillar choice to database

      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `Spare us 5 minutes to help us improve your SUTD Open House experience: \n${config.surveyLink} \n\nYour feedback means a lot to us! 🙏`,
        parse_mode: "HTML",
      });
      return;

    default:
      console.error(`❌ Error: Unknown user state "${user.postEventState}"`);
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "⚠️ Something went wrong. Please try again later.",
        parse_mode: "HTML",
      });
      break;
  }
}

module.exports = { post_event_states, handlePostEvent };
