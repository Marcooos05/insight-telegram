// IMPORTS
const structProtoToJson =
    require('../../botlib/proto_to_json.js').structProtoToJson;
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const FormData = require('form-data');
const fs = require('fs');
const admin = require('firebase-admin');
// Path to your service account key JSON file
const serviceAccount = require('./firestore-key.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Initialize Firestore
const db = admin.firestore();

// Credentials


// CONSTANTS
const DATE = "24 Feb" // Change date here
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const states = {
  START: "START",
  GET_NAME: "GET_NAME",
  GET_EMAIL: "GET_EMAIL",
  GET_PHONE: "GET_PHONE",
  SELECT_GROUP: "SELECT_GROUP",
  SELECT_PILLAR: "SELECT_PILLAR",
  CONFIRMATION: "CONFIRMATION",
  PLANNER: "PLANNER",
  FINISH: "FINISH"
};
const WEBHOOK = SERVER_URL + URI;
const app = express();

app.use(bodyParser.json());

// Imports the Google Cloud Some API library
const {SessionsClient} = require('@google-cloud/dialogflow-cx');
/**
 * Example for regional endpoint:
 *   const locationId = 'us-central1'
 *   const client = new SessionsClient({apiEndpoint:
 * 'us-central1-dialogflow.googleapis.com'})
 */
const client = new SessionsClient(
    {apiEndpoint: locationId + '-dialogflow.googleapis.com'});

// Converts Telgram request to a detectIntent request.
function telegramToDetectIntent(telegramRequest, sessionPath) {
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: telegramRequest.message.chat.id + ": " + telegramRequest.message.text
      },
      languageCode,
    }
  };

  return request;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Converts detectIntent responses to Telegram message requests.
async function convertToTelegramMessage(responses, chatId) {
  let replies = [];

  for (let response of responses.queryResult.responseMessages) {
    let reply;

    switch (true) {
      case response.hasOwnProperty('text'): {
        reply = {chat_id: chatId, text: response.text.text.join()};
        break;
      };

      /**
       * The layout for the custom payload responses can be found in these
       * sites: Buttons: https://core.telegram.org/bots/api#inlinekeyboardmarkup
       * Photos: https://core.telegram.org/bots/api#sendphoto
       * Voice Audios: https://core.telegram.org/bots/api#sendvoice
       */
      case response.hasOwnProperty('payload'): {
        reply = await structProtoToJson(response.payload);
        reply['chat_id'] = chatId;
        break;
      };

      default:
    };
    if (reply) {
      replies.push(reply);
    };
  }

  return replies;
}

/**
 * Takes as input a request from Telegram and converts the request to
 * detectIntent request which is used to call the detectIntent() function
 * and finally output the response given by detectIntent().
 */
async function detectIntentResponse(telegramRequest) {
  const sessionId = telegramRequest.message.chat.id;
  const sessionPath = client.projectLocationAgentSessionPath(
      projectId, locationId, agentId, sessionId);
  console.info(sessionPath);

  request = telegramToDetectIntent(telegramRequest, sessionPath);
  const [response] = await client.detectIntent(request);

  return response;
};

const setup = async () => {
  const res = await axios.post(`${API_URL}/setWebhook`, {url: WEBHOOK});
  console.log(res.data);
};

const sendTypingAction = async (chatId) => {
  try {
    await axios.post(`${API_URL}/sendChatAction`, {
      chat_id: chatId,
      action: 'typing', // Typing action
    });
  } catch (error) {
    console.error('Error sending typing action:', error.message);
  }
};

const userStates = {}; // In-memory store for tracking user registration state

// Function to handle registration flow
async function handleRegistration(chatId, messageText) {
  if (!userStates[chatId]) {
    // Initialize user state
    userStates[chatId] = { state: states.PLANNER, data: {} };
  }

  const user = userStates[chatId];

  switch (user.state) {
    case states.START:
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "🎉 <b>Welcome to the SUTD Open House!</b> 🎉\n" +
              "Let’s get started! What’s your name? 😊",
        parse_mode: "HTML",
      });
      user.state = states.GET_NAME;
      break;

    case states.GET_NAME: // Step 2: Get email
      if (messageText.trim().length === 0) {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Oops! Name cannot be empty. Please tell me your name 😊",
          parse_mode: "HTML"
        });
        return;
      }
      user.data.name = messageText; // Save the name
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: `Nice to meet you, <b>${messageText}</b>! 🤝\nCan I grab your email so I can share updates and help you even after the Open House? 📧`,
        parse_mode: "HTML" // Enables bold and clean formatting
      });
      user.state = states.GET_EMAIL;
      break;

    case states.GET_EMAIL:
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
         text: "Thanks a bunch! 🙌 \nJust one more thing – could you share your phone number? " +
            "In case we need to contact you after Open House! 📱",
        parse_mode: "HTML",
      });
      user.state = states.GET_PHONE;
      break;

    case states.GET_PHONE:
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
        text: "Awesome! 🚀 Before we dive in, I’d love to know – which best describes you? \n" +
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
      user.state = states.SELECT_GROUP;
      break;


    case states.SELECT_GROUP:
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
        text: "🌟<b>Wonderful to have you here at the SUTD Open House 2025!</b>🌟\n\n" +
        "Before we proceed, is there any course of study you are particularly interested in? 👇\n" +
        "1️⃣ <b>Computer Science and Design (CSD)</b>\n" +
        "2️⃣ <b>Architecture and Sustainable Design (ASD)</b>\n" +
        "3️⃣ <b>Engineering Systems and Design (ESD)</b>\n" +
        "4️⃣ <b>Engineering Product Development (EPD)</b>\n" +
        "5️⃣ <b>Design and Artificial Intelligence (DAI)</b>\n" +
        "6️⃣ <b>None</b>",
        parse_mode: "HTML",
        reply_markup: {
          keyboard: [
            [{ text: "CSD" }],
            [{ text: "ASD" }],
            [{ text: "ESD" }],
            [{ text: "EPD" }],
            [{ text: "DAI" }],
            [{ text: "None" }],
          ],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      });
      user.state = states.SELECT_PILLAR;
      break;

    case states.SELECT_PILLAR:
      if (!["CSD", "ASD", "ESD", "EPD", "DAI", "None"].includes(messageText)) {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Please select one of the provided options.",
          parse_mode: "HTML",
        });
        return;
      }
      user.data.pillar = messageText;
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "✅ <b>Please review your details carefully before submitting.</b>\n\n" +
          "By clicking ‘Yes,’ you consent to your data being used for event purposes. Be assured that you will not be contacted unless you have expressed your interest. 📢\n\n" +
          "<b>Name:</b> " + user.data.name + "\n" +
          "<b>Email Address:</b> " + user.data.email + "\n" +
          "<b>Contact Number:</b> " + user.data.phone + "\n" +
          "<b>Group Type:</b> " + user.data.groupType + "\n" +
          "<b>Pillar of Interest:</b> " + user.data.pillar + "\n\n" +
          "If all looks good, please click ‘Yes’ to proceed! 😊",
        parse_mode: "HTML", // Enables bold and clean formatting
        reply_markup: {
      keyboard: [
        [{ text: "Yes" }],
        [{ text: "No" }],
      ],
      one_time_keyboard: true, // The keyboard disappears after selection
      resize_keyboard: true // Resizes the keyboard for a better UI
      }});
      user.state = states.CONFIRMATION;
      break;


    case states.CONFIRMATION:
      if (messageText.toLowerCase() !== "yes") {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "It seems you want to make changes. Please restart with /start.",
          parse_mode: "HTML",
        });
        delete userStates[chatId];
      }
      else {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Generating a personalised card for you and saving your data. Please wait patiently...",
          parse_mode: "HTML" // Enables bold and clean formatting
        });
      // Generate the card using DALL-E
      // const cardDescription = A personalized card with the user's name "${state.data.name}", email "${state.data.color}", contact number "${state.data.hobby}", and the character will be a "${state.data.audienceType}" in a retro game design.;
      // const dalleImageResponse = await generateCardImage(cardDescription);
      //
      // if (dalleImageResponse && dalleImageResponse.data && dalleImageResponse.data[0]) {
      //   const imageUrl = dalleImageResponse.data[0].url; // Extract the image URL
      //
      //   try {
      //     // Debug: Log the URL to ensure it's correctly extracted
      //     console.log("Image URL to send:", imageUrl);
      //
      //     axios.post(${API_URL}/sendPhoto, {
      //       chat_id: chatId,
      //       photo: imageUrl, // Use the URL as-is
      //       caption: Here's your personalized card, ${state.data.name}!,
      //     });
      //   } catch (error) {
      //     console.error('Error sending photo to Telegram:', error.response?.data || error.message);
      //   }
      // }
      // else {
        await sleep(3000)
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "With that, here are the events that are happening on today's Open House",
          parse_mode: "HTML" // Enables bold and clean formatting
          // text: "Oops, something went wrong while generating your card. Please try again later with /start.",
        });
        await showEvents(chatId)
        await sleep(3000)
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "✨Now, I will help you to plan your schedule. Do you have an idea of what events you want to go today? I'll wait for you to decide :) ✨",
          parse_mode: "HTML", // Enables bold and clean formatting
          reply_markup: {
        keyboard: [
          [{ text: "Yes" }],
          [{ text: "No" }],
        ],
        one_time_keyboard: true, // The keyboard disappears after selection
        resize_keyboard: true // Resizes the keyboard for a better UI
        }});
      }
      user.state = states.PLANNER;
      break;

    case states.PLANNER: // Questionaire or allow them to choose among the events
      const itemsPerPage = 6; // Max buttons per page
      let currentPage = 0; // Dynamically track the current page

      try {
        // Reference the document for today's events
        const eventsDoc = db.collection("events").doc(DATE);
        const docSnapshot = await eventsDoc.get();
        // Fetch and map the event names into inline buttons
        if (docSnapshot.exists) {
          const eventsDict = docSnapshot.data();
          const events = Object.keys(eventsDict).map((eventName) => ({
            name: eventName,
            id: eventName.toLowerCase().replace(/\s+/g, "_"),
          }));

          // Calculate pagination
          const totalPages = Math.ceil(events.length / itemsPerPage);
          const startIndex = currentPage * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;

          // Slice events for the current page
          const inlineKeyboard = events.slice(startIndex, endIndex).map((event) => [
            {text: event.name, callback_data: `event_${event.id}`},
          ]);

          // Add navigation buttons
          if (currentPage > 0) {
            inlineKeyboard.push([{text: "⬅️ Previous", callback_data: `page_${currentPage - 1}`}]);
          }
          if (currentPage < totalPages - 1) {
            inlineKeyboard.push([{text: "Next ➡️", callback_data: `page_${currentPage + 1}`}]);
          }
          console.log(inlineKeyboard)
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "Which events are you interested in attending today? 🗓️",
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: inlineKeyboard,
            },
          });
        } else {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "There were no events found 🗓️",
            parse_mode: "HTML"
          })
        }
      } catch (error) {
        console.error("Error fetching or sending events:", error.message);

        // Notify the user of an error
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "Oops! Something went wrong while fetching the events. Please try again later. ⚠️",
          parse_mode: "HTML",
        });
      }
      user.state = states.FINISH; //temporary
      break;

    default:
      await axios.post(`${API_URL}/sendMessage`, {
        chat_id: chatId,
        text: "Something went wrong with your registration. Please try again with /start",
        parse_mode: "HTML" // Enables bold and clean formatting
      });
      delete userStates[chatId]; // Reset state
  }
}

// Function to generate the card using DALL-E
async function generateCardImage(description) {
  try {
    const response = await axios.post('https://api.openai.com/v1/images/generations', {
      prompt: description,
      size: "1024x1024",
      n: 1,
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`, // Replace with your OpenAI API key
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error generating DALL-E image:', error.message);
    return null;
  }
}

// Function to show the events pictures
async function showEvents(chatId){
  try {
      const event1Data = new FormData();
      const event2Data = new FormData();
      event1Data.append("chat_id", chatId);
      event2Data.append("chat_id", chatId);
      event1Data.append("photo", fs.createReadStream("./static/events_1.jpg"));
      event2Data.append("photo", fs.createReadStream("./static/events_2.jpg"));
      // Sending photos in parallel
      await Promise.all([
        axios.post(`${API_URL}/sendPhoto`, event1Data, {
          headers: event1Data.getHeaders(),
        }),
        axios.post(`${API_URL}/sendPhoto`, event2Data, {
          headers: event2Data.getHeaders(),
        }),
    ]);
  } catch (error) {
    console.error('Error showing picture of events:', error.message);
  }
}

app.post(URI, async (req, res) => {
  const chatId = req.body.message.chat.id;
  const messageText = req.body.message.text;

  try {
    // Check if the user is in the registration flow
    await sendTypingAction(chatId);
    if (userStates[chatId]?.state !== states.FINISH) {
      if (messageText === '/events') {
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "🎉 <b>Please register first using /start! </b> 😊",
          parse_mode: "HTML" // Enables bold and clean formatting
        });
      } else {
        // Continue the registration flow
        await handleRegistration(chatId, messageText);
      }
    }
    else {
      // normal state flow after registration
      if (messageText === '/start') {
        // Should now allow start handler anymore after registering
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "🎉 <b>You have already registered. Please contact @zedithx on telegram for further help </b> 😊",
          parse_mode: "HTML" // Enables bold and clean formatting
        });
      }
      else if (messageText === '/events') {
        // Initial message
        await axios.post(`${API_URL}/sendMessage`, {
          chat_id: chatId,
          text: "🎉 <b>Please view the event schedules below! </b> 😊",
          parse_mode: "HTML", // Enables bold and clean formatting
        });
        await showEvents(chatId)
      }
      else {
        // Proceed with Dialogflow interaction if no keywords
        const response = await detectIntentResponse(req.body);
        // console.info("Dialogflow Response:", JSON.stringify(response, null, 2));
        const requests = await convertToTelegramMessage(response, chatId);
        // console.info("Converted Requests:", requests);

        for (const request of requests) {
          if (request.hasOwnProperty('photo')) {
            await axios.post(`${API_URL}/sendPhoto`, request).catch((error) => console.error(error));
          } else if (request.hasOwnProperty('voice')) {
            await axios.post(`${API_URL}/sendVoice`, request).catch((error) => console.error(error));
          } else {
            await axios.post(`${API_URL}/sendMessage`, request).catch((error) => console.error(error));
          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling webhook:', error.message);
  }

  res.send();
});

const listener = app.listen(process.env.PORT, async () => {
  console.log(
      'Your Dialogflow integration server is listening on port ' +
      listener.address().port);

  await setup();
});

module.exports = {
  telegramToDetectIntent,
  convertToTelegramMessage
};
