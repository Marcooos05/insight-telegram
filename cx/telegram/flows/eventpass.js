require("dotenv").config();
const config = require("../config");
const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");

// Function to handle registration flow
const { createEventPass } = require("../comfyUI/generate_event_pass");

const event_states = {
  SELECT_GENDER: "SELECT_GENDER",
  SELECT_PILLAR: "SELECT_PILLAR",
  SELECT_INTEREST: "SELECT_INTEREST",
  END_EVENT: "END_EVENT",
};

const EVENT_START = event_states.SELECT_GENDER;
const END_FLOW = event_states.END_EVENT;

async function handleEventPass(chatId, messageText, user, API_URL) {
  switch (user.state) {
    case event_states.SELECT_GENDER: // Step 2: Get the choice of pillar
      if (!["Male", "Female"].includes(messageText)) {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Please select one of the provided options.",
          parse_mode: "HTML",
        });
        return;
      }
      user.data.gender = messageText;
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text:
          "🌟<b>Wonderful</b>🌟\n\n" +
          "Which SUTD pillar interests you the most? 👇\n" +
          "1️⃣ <b>Architecture and Sustainable Design (ASD)</b>\n" +
          "2️⃣ <b>Computer Science and Design (CSD)</b>\n" +
          "3️⃣ <b>Design and Artificial Intelligence (DAI)</b>\n" +
          "4️⃣ <b>Engineering Product Development (EPD)</b>\n" +
          "5️⃣ <b>Engineering Systems and Design (ESD)</b>\n" +
          "6️⃣ <b>No Preferred Pillar</b>",
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "ASD" }],
            [{ text: "CSD" }],
            [{ text: "DAI" }],
            [{ text: "EPD" }],
            [{ text: "ESD" }],
            [{ text: "No Preferred Pillar" }],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
      user.state = event_states.SELECT_PILLAR;
      break;

    case event_states.SELECT_PILLAR:
      if (
        !["CSD", "ASD", "ESD", "EPD", "DAI", "No Preferred Pillar"].includes(
          messageText
        )
      ) {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Please select one of the provided options.",
          parse_mode: "HTML",
        });
        return;
      }

      if (messageText == "No Preferred Pillar") {
        user.data.pillar = "SUTD";
      } else {
        user.data.pillar = messageText;
      }
      // IF DATE IS AFTER 23 FEB OR PREREGISTER == FALSE THEN SKIP THIS STEP CHANGE STATE TO SELECT_INTEREST
      const currentDate = new Date();
      const eventDate = new Date(config.openHouseDate);

      if (currentDate > eventDate || !config.isPreRegistration) {
        // Skip the interest selection step
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "⌛Generating a personalised digital pass for you. Your pass will be ready in a moment! Please wait patiently...⚡️",
          parse_mode: "HTML", // Enables bold and clean formatting
        });
        try {
          const eventPassPath = await createEventPass({
            pillar: user.data.pillar,
            chatID: chatId,
            name: user.data.name,
            customAvatar: false,
            avatarType: user.data.gender,
          });
          // Create a FormData object to send the image
          const form = new FormData();
          form.append("chat_id", chatId);
          form.append("photo", fs.createReadStream(eventPassPath));

          // Send the image to Telegram
          await axios.post(`${API_URL}/sendPhoto`, form, {
            headers: form.getHeaders(),
          });

          try {
            axios.put(`${config.backendURL}/api/register-user/${chatId}`);
          } catch (error) {
            console.error("Error updating user status:", error.message);
          }

          fs.unlinkSync(eventPassPath); // Delete the image after sending
          console.log("Event pass sent successfully");
        } catch (error) {
          console.error("Error creating or sending event pass:", error.message);
        }

        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "⌛Here is your personalised digital pass!! Show your pass at the Welcome and Info Booth @ Campus Centre Level 1 to collect your goodie bag! 🎉🎉🎉",
          parse_mode: "HTML", // Enables bold and clean formatting
        });
        user.state = END_FLOW;
      } else {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text:
            "Lastly, 🌟 Let's get to know you better! 🌟\n" +
            "What are your interests?\n" +
            "<b>🤖 Robotics & Mechatronics</b>\n" +
            "<b>🛠️ Product Design</b>\n" +
            "<b>🏗️ Architecture Design</b>\n" +
            "<b>💻 Software development</b>\n" +
            "<b>📊 Data Science & Analytics</b>\n",
          parse_mode: "HTML", // Enables bold and clean formatting
          reply_markup: {
            keyboard: [
              [{ text: "Robotics & Mechatronics" }],
              [{ text: "Product Design" }],
              [{ text: "Architecture Design" }],
              [{ text: "Software development" }],
              [{ text: "Data Science & Analytics" }],
            ],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        });
        user.state = event_states.SELECT_INTEREST;
      }

      break;

    case event_states.SELECT_INTEREST:
      //TO ADD CONDITIONAL STATEMENT FOR PREREGISTERED IF FALSE THEN GENERATE USING THE SAMPLE
      if (
        ![
          "Robotics & Mechatronics",
          "Product Design",
          "Architecture Design",
          "Software development",
          "Data Science & Analytics",
        ].includes(messageText)
      ) {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Please select one of the provided options.",
          parse_mode: "HTML",
        });
        return;
      }
      user.data.interest = messageText;
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "⌛Generating a personalised digital pass for you. Your pass will be ready in a moment! Please wait patiently...⚡️",
        parse_mode: "HTML", // Enables bold and clean formatting
      });

      try {
        const eventPassPath = await createEventPass({
          pillar: user.data.pillar,
          chatID: chatId,
          name: user.data.name,
          customAvatar: true,
          avatarType: user.data.gender,
          personalInterest: user.data.interest,
          SERVER_ADDRESS: process.env.COMFYUI_ADDRESS,
        });
        // Create a FormData object to send the image
        const form = new FormData();
        form.append("chat_id", chatId);
        form.append("photo", fs.createReadStream(eventPassPath));

        // Send the image to Telegram
        await axios.post(`${API_URL}/sendPhoto`, form, {
          headers: form.getHeaders(),
        });

        try {
          axios.put(`${config.backendURL}/api/register-user/${chatId}`);
        } catch (error) {
          console.error("Error updating user status:", error.message);
        }

        fs.unlinkSync(eventPassPath); // Delete the image after sending
        console.log("Event pass sent successfully");
      } catch (error) {
        console.error("Error creating or sending event pass:", error.message);
      }
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "⌛Here is your personalised digital pass!! Show your pass at the Welcome and Info Booth @ Campus Centre Level 1 to collect your goodie bag! 🎉🎉🎉",
        parse_mode: "HTML", // Enables bold and clean formatting
      });
      user.state = END_FLOW;
      break;

    default:
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "Something went wrong with creating your pass. Please try again later",
        parse_mode: "HTML", // Enables bold and clean formatting
      });
  }
}

module.exports = { EVENT_START, END_FLOW, event_states, handleEventPass };
