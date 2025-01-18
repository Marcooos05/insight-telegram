require("dotenv").config();
const axios = require("axios");

// Function to handle registration flow
const { sleep } = require("../utils/Sleep");

// Standardise event_start and states
const { EVENT_START, event_states, handleEventPass } = require("./eventpass");
const admin = require("firebase-admin");

// Define state for end of registration flow
const reg_states = {
  START: "START",
  SELECT_GROUP: "SELECT_GROUP",
  GET_NAME: "GET_NAME",
  GET_EMAIL: "GET_EMAIL",
  GET_PHONE: "GET_PHONE",
  GET_SCHOOL: "GET_SCHOOL",
  CONFIRMATION: "CONFIRMATION",
};

async function handleRegistration(chatId, messageText, userStates, API_URL) {
  console.info("userState:" + userStates[chatId]);
  if (!userStates[chatId]) {
    // Initialize user state
    userStates[chatId] = { state: reg_states.START, data: {} };
    //TODO - save chatID state into postgres on DO backend
  }
  if (userStates[chatId].state in event_states) {
    const user_state = userStates[chatId];
    await handleEventPass(chatId, messageText, user_state, API_URL);
  } else {
    const user = userStates[chatId];
    //TODO - get chatID state from postgres on DO backend
    switch (user.state) {
      case reg_states.START: // Step 1 : Get name
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text:
            "🎉 <b>Welcome to the SUTD Open House!</b> 🎉\n" +
            "I’m your friendly AI chatbot here to help you make the most of your day. Let’s get started! 😊\n" +
            "Which of these options best describes you?\n" +
            "1️⃣ <b>Prospective Student</b> 🎓\n" +
            "2️⃣ <b>Parent</b> 🧑‍🤝‍🧑\n" +
            "3️⃣ <b>Other</b> 🌟",
          parse_mode: "HTML",
          reply_markup: {
            keyboard: [
              [{ text: "Prospective Student" }],
              [{ text: "Parent" }],
              [{ text: "Other" }],
            ],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        });
        user.state = reg_states.SELECT_GROUP;
        //TODO - save chatID state into postgres on DO backend
        break;

      case reg_states.SELECT_GROUP: // Step 2: Get Group
        if (!["Prospective Student", "Parent", "Other"].includes(messageText)) {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "Please select one of the provided options.",
            parse_mode: "HTML",
          });
          return;
        }
        user.data.groupType = messageText;
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text:
            "Awesome! 🚀\n" + "Before we dive in, what’s your full name? 😊",
          parse_mode: "HTML",
        });
        user.state = reg_states.GET_NAME;
        //TODO - save chatID state into postgres on DO backend
        break;

      case reg_states.GET_NAME: // Step 3: Get Email
        if (messageText.trim().length === 0) {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "Oops! Name cannot be empty. Please tell me your name 😊",
            parse_mode: "HTML",
          });
          return;
        }
        user.data.name = messageText; // Save the name
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: `Nice to meet you, <b>${messageText}</b>! 🤝\nCan I grab your email so I can share updates and help you even after the Open House? 📧`,
          parse_mode: "HTML", // Enables bold and clean formatting
        });
        user.state = reg_states.GET_EMAIL;
        //TODO - save chatID state into postgres on DO backend
        break;

      case reg_states.GET_EMAIL: // Step 4: Get number
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(messageText)) {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "Hmm, that doesn't look like a valid email. Please try again. 📧",
            parse_mode: "HTML",
          });
          return;
        }
        user.data.email = messageText;
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text:
            "Thanks a bunch! 🙌 \nJust one more thing – could you share your phone number? " +
            "In case we need to contact you after Open House! 📱",
          parse_mode: "HTML",
        });
        user.state = reg_states.GET_PHONE;
        //TODO - save chatID state into postgres on DO backend
        break;

      case reg_states.GET_PHONE: // Step 5: Get user's school
        if (!/^[689]\d{7}$/.test(messageText)) {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "That doesn't seem like a valid phone number. Please try again. 📱",
            parse_mode: "HTML",
          });
          return;
        }
        user.data.phone = messageText;
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text:
            "🏫 We'd love to know more about you!\n" +
            "Which school were you from? (Reply NA if Not Applicable)",
          parse_mode: "HTML",
        });
        user.state = reg_states.GET_SCHOOL;
        //TODO - save chatID state into postgres on DO backend
        break;

      case reg_states.GET_SCHOOL: //confirmation and PDPA clause
        user.data.school = messageText;
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text:
            "✅ <b>Please review your details carefully before submitting.</b>\n\n" +
            "By clicking 'Yes', you consent to the collection and use of my personal information as captured on the registration process, as well as photographs and other audio-visual information captured during the event, by Singapore University of Technology and Design (SUTD), including the disclosure to SUTD trusted third parties. The personal information collected will be used for the purposes of communicating relevant news about SUTD the event, by Singapore University of Technology and Design invitations to future events. Be assured that you will not be contacted unless you have expressed your interest. 📢\n\n" +
            "<b>Name:</b> " +
            user.data.name +
            "\n" +
            "<b>Email Address:</b> " +
            user.data.email +
            "\n" +
            "<b>Contact Number:</b> " +
            user.data.phone +
            "\n" +
            "<b>Group Type:</b> " +
            user.data.groupType +
            "\n" +
            "<b>School:</b> " +
            user.data.school +
            "\n\n" +
            "If all looks good, please click ‘Yes’ to proceed! 😊",
          parse_mode: "HTML", // Enables bold and clean formatting
          reply_markup: {
            keyboard: [[{ text: "Yes" }], [{ text: "No" }]],
            one_time_keyboard: true, // The keyboard disappears after selection
            resize_keyboard: true, // Resizes the keyboard for a better UI
          },
        });
        user.state = reg_states.CONFIRMATION;
        //TODO - save chatID state into postgres on DO backend
        break;

      case reg_states.CONFIRMATION: // Step 1: Select gender
        if (!["Yes", "No", "YES", "NO", "yes", "no"].includes(messageText)) {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "Sorry I didn't get that. Please reply with 'Yes' or 'No'.",
            parse_mode: "HTML",
          });
          return;
        }
        if (messageText.toLowerCase() == "no") {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "It seems you want to make changes. Please restart with /start.",
            parse_mode: "HTML",
          });
          user.state = reg_states.START;
          //TODO - save chatID state into postgres on DO backend
        } else {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "Registering you for SUTD Open House 2025. Please wait patiently...",
            parse_mode: "HTML", // Enables bold and clean formatting
          });

          //TODO - save data into postgres on DO backend

          await admin.firestore().collection("registration").doc(chatId).set({
            name: user.data.name,
            email: user.data.email,
            phone: user.data.phone,
            groupType: user.data.groupType,
            school: user.data.school,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          //await sleep(4);
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text:
              "You have been registered successfully. Now, we can proceed to creating your " +
              "very own event pass to be used in the Open House. \n\n" +
              "To begin, what gender are you?",
            parse_mode: "HTML",
            reply_markup: {
              keyboard: [
                [{ text: "Male" }],
                [{ text: "Female" }],
                // [{ text: "Other" }],
              ],
              one_time_keyboard: true, // The keyboard disappears after selection
              resize_keyboard: true, // Resizes the keyboard for a better UI
            }, // Enables bold and clean formatting
          });
          // state will now be handled by eventpass handler
          user.state = EVENT_START;
          //TODO - save chatID state into postgres on DO backend
          break;
        }

      default:
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Something went wrong with your registration. Please try again with /start",
          parse_mode: "HTML", // Enables bold and clean formatting
        });
        delete userStates[chatId]; // Reset state
      //TODO - save chatID state into postgres on DO backend
    }
  }
}

module.exports = { handleRegistration };
