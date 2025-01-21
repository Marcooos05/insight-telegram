require("dotenv").config();
const structProtoToJson =
  require("../../botlib/proto_to_json.js").structProtoToJson;
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const FormData = require("form-data");
const fs = require("fs");
// const admin = require("firebase-admin");
// // Path to your service account key JSON file
// const serviceAccount = require("./firestore-key.json");
const handleCallbackQuery = require("./utils/HandleCallbackQuery.js");
const config = require("./config.js");

// // Initialize Firebase Admin SDK
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// // Initialize Firestore
// const db = admin.firestore();

// Load environment variables
const projectId = process.env.PROJECT_ID;
const locationId = process.env.LOCATION_ID;
const agentId = process.env.AGENT_ID;
const languageCode = process.env.LANGUAGE_CODE;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const SERVER_URL = process.env.SERVER_URL;
const API_KEY = process.env.API_KEY;

// CONSTANTS
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const WEBHOOK = SERVER_URL + URI;
const app = express();

app.use(bodyParser.json());

// Imports the Google Cloud Some API library
const { SessionsClient } = require("@google-cloud/dialogflow-cx");

// Import from other files
const { handleRegistration } = require("./flows/registration");
const { handleDelete } = require("./flows/delete");
const { handlePlanning } = require("./flows/planning");
const { handlePostEvent } = require("./flows/postevent");
const { END_FLOW } = require("./flows/eventpass");
const { PLANNING_START } = require("./flows/planning");
const { sleep } = require("./utils/Sleep");

/**
 * Example for regional endpoint:
 *   const locationId = 'us-central1'
 *   const client = new SessionsClient({apiEndpoint:
 * 'us-central1-dialogflow.googleapis.com'})
 */
const client = new SessionsClient({
  apiEndpoint: locationId + "-dialogflow.googleapis.com",
});

// Converts Telgram request to a detectIntent request.
function telegramToDetectIntent(telegramRequest, sessionPath) {
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text:
          telegramRequest.message.chat.id + ": " + telegramRequest.message.text,
      },
      languageCode,
    },
  };

  return request;
}

// Converts detectIntent responses to Telegram message requests.
async function convertToTelegramMessage(responses, chatId) {
  let replies = [];

  for (let response of responses.queryResult.responseMessages) {
    let reply;

    switch (true) {
      case response.hasOwnProperty("text"): {
        reply = { chat_id: chatId, text: response.text.text.join() };
        break;
      }

      /**
       * The layout for the custom payload responses can be found in these
       * sites: Buttons: https://core.telegram.org/bots/api#inlinekeyboardmarkup
       * Photos: https://core.telegram.org/bots/api#sendphoto
       * Voice Audios: https://core.telegram.org/bots/api#sendvoice
       */
      case response.hasOwnProperty("payload"): {
        reply = await structProtoToJson(response.payload);
        reply["chat_id"] = chatId;
        break;
      }

      default:
    }
    if (reply) {
      replies.push(reply);
    }
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
    projectId,
    locationId,
    agentId,
    sessionId
  );
  console.info(sessionPath);

  request = telegramToDetectIntent(telegramRequest, sessionPath);
  const [response] = await client.detectIntent(request);

  return response;
}

const setup = async () => {
  const res = await axios.post(`${API_URL}/setWebhook`, { url: WEBHOOK });
};

const sendTypingAction = async (chatId) => {
  try {
    await axios.post(`${API_URL}/sendChatAction`, {
      chat_id: chatId,
      action: "typing", // Typing action
    });
  } catch (error) {
    console.error("Error sending typing action:", error.message);
  }
};

const userStates = {}; // In-memory store for tracking user registration state

// Function to generate the card using DALL-E
async function generateCardImage(description) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/images/generations",
      {
        prompt: description,
        size: "1024x1024",
        n: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`, // Replace with your OpenAI API key
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error generating DALL-E image:", error.message);
    return null;
  }
}

// Function to show the events pictures
async function showEvents(chatId) {
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
    console.error("Error showing picture of events:", error.message);
  }
}

app.post(URI, async (req, res) => {
  if (req.body.callback_query) {
    const callbackQuery = req.body.callback_query;
    const chatId = callbackQuery.message.chat.id;
    const callbackQueryId = callbackQuery.id;
    const callbackData = callbackQuery.data;
    await handleCallbackQuery(chatId, callbackData, API_URL, callbackQueryId);
  } else {
    try {
      const chatId = req.body.message.chat.id;
      const messageText = req.body.message.text;
      // Check if the user is in the registration flow
      await sendTypingAction(chatId);

      let userState;
      try {
        const response = await axios.get(
          `${config.backendURL}/api/get-user-status/${chatId}`
        );
        console.log("Backend response chatID:", response.data);

        userState = response.data.status;
      } catch (error) {
        console.error("Error connecting to backend:", error.message);
      }

      if (config.unregisteredStatus.includes(userState)) {
        //If user is "Not Found" or "Deleted"
        if (messageText === "/events") {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "🎉 <b>Please register first using /start! </b> 😊",
            parse_mode: "HTML", // Enables bold and clean formatting
          });
        } else if (messageText === "/delete") {
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "⚠️ <b>Your account does not exist. Please register first using /start!</b> 😊",
            parse_mode: "HTML", // Enables bold and clean formatting
          });
        } else {
          // Continue the registration flow
          await handleRegistration(chatId, messageText, userStates, API_URL);
        }
      } else if (config.postEventBoolean) {
        //Should only enter this block after event has ended and telegram bot initiated a message
        //If event has ended
        await handlePostEvent(chatId, messageText, userStates, API_URL);
      } else {
        if (userStates[chatId] === undefined) {
          userStates[chatId] = { state: END_FLOW };
        }
        //If user is Registered
        if (messageText === "/start") {
          // Should not allow start handler anymore after registering
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "🎉 <b>You have already registered. Please do /delete to remove your registration entry first!</b> 😊",
            parse_mode: "HTML", // Enables bold and clean formatting
          });
        } else if (messageText === "/events") {
          // Initial message
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text: "🎉 <b>Here are the exciting events happening at SUTD Open House 2025!</b> 😊",
            parse_mode: "HTML", // Enables bold and clean formatting
          });
          await showEvents(chatId);
          await sleep(3000);
          await axios.post(`${API_URL}/sendMessage`, {
            chat_id: chatId,
            text:
              "<b>🗺️ Would you like me to help plan your SUTD Open House visit today?\n</b>" +
              "1️⃣ <b>⏳ Maybe later</b> 🎓\n" +
              "2️⃣ <b>✅ Yes, help me plan my journey</b> 🧑‍🤝‍🧑",
            parse_mode: "HTML", // Enables bold and clean formatting
            reply_markup: {
              keyboard: [[{ text: "Later" }], [{ text: "Yes" }]],
              one_time_keyboard: true,
              resize_keyboard: true,
            },
          });
          userStates[chatId].state = PLANNING_START;
          userStates[chatId].planning = true;
        } else if (messageText === "/delete" || userStates[chatId]?.delete) {
          await handleDelete(chatId, messageText, userStates, API_URL);
        } else {
          // Proceed with Dialogflow interaction if no keywords
          const response = await detectIntentResponse(req.body);
          // console.info("Dialogflow Response:", JSON.stringify(response, null, 2));
          const requests = await convertToTelegramMessage(response, chatId);
          // console.info("Converted Requests:", requests);

          for (const request of requests) {
            if (request.hasOwnProperty("photo")) {
              await axios
                .post(`${API_URL}/sendPhoto`, request)
                .catch((error) => console.error(error));
            } else if (request.hasOwnProperty("voice")) {
              await axios
                .post(`${API_URL}/sendVoice`, request)
                .catch((error) => console.error(error));
            } else {
              await axios
                .post(`${API_URL}/sendMessage`, request)
                .catch((error) => console.error(error));
            }
          }
        }
      }

      // if (userStates[chatId]?.state !== END_FLOW) {
      //   if (messageText === "/events") {
      //     await axios.post(`${API_URL}/sendMessage`, {
      //       chat_id: chatId,
      //       text: "🎉 <b>Please register first using /start! </b> 😊",
      //       parse_mode: "HTML", // Enables bold and clean formatting
      //     });
      //   }
      //   //Nothing to delete if not registered yet
      //   //  else if (messageText === "/delete" || userStates[chatId]?.delete) {
      //   //   await handleDelete(chatId, messageText, userStates, API_URL);
      //   // }
      //   else {
      //     // Continue the registration flow
      //     await handleRegistration(chatId, messageText, userStates, API_URL);
      //   }
      // } else {
      //   // normal state flow after registration
      //   if (messageText === "/start") {
      //     // Should not allow start handler anymore after registering
      //     await axios.post(`${API_URL}/sendMessage`, {
      //       chat_id: chatId,
      //       text:
      //         "🎉 <b>You have already registered. Please do /delete to remove your registration" +
      //         "entry first!</b> 😊",
      //       parse_mode: "HTML", // Enables bold and clean formatting
      //     });
      //   } else if (messageText === "/events") {
      //     // Initial message
      //     await axios.post(`${API_URL}/sendMessage`, {
      //       chat_id: chatId,
      //       text: "🎉 <b>Here are the exciting events happening at SUTD Open House 2025!</b> 😊",
      //       parse_mode: "HTML", // Enables bold and clean formatting
      //     });
      //     await showEvents(chatId);
      //     await axios.post(`${API_URL}/sendMessage`, {
      //       chat_id: chatId,
      //       text:
      //         "<b>🗺️ Would you like me to help plan your SUTD Open House visit today?\n</b>" +
      //         "1️⃣ <b>⏳ Maybe later</b> 🎓\n" +
      //         "2️⃣ <b>✅ Yes, help me plan my journey</b> 🧑‍🤝‍🧑",
      //       parse_mode: "HTML", // Enables bold and clean formatting
      //       reply_markup: {
      //         keyboard: [[{ text: "Later" }], [{ text: "Yes" }]],
      //         one_time_keyboard: true,
      //         resize_keyboard: true,
      //       },
      //     });
      //     userStates[chatId].plan = true;
      //   } else if (userStates[chatId]?.plan) {
      //     //Holder placement before event planner is complete
      //     await axios.post(`${API_URL}/sendMessage`, {
      //       chat_id: chatId,
      //       text: "🎉 <b>Feature still in progress, look out for new updates soon...</b> 😊",
      //       parse_mode: "HTML", // Enables bold and clean formatting
      //     });
      //     // await handlePlanning();
      //   } else if (messageText === "/delete" || userStates[chatId]?.delete) {
      //     await handleDelete(chatId, messageText, userStates, API_URL);
      //   } else {
      //     // Proceed with Dialogflow interaction if no keywords
      //     const response = await detectIntentResponse(req.body);
      //     // console.info("Dialogflow Response:", JSON.stringify(response, null, 2));
      //     const requests = await convertToTelegramMessage(response, chatId);
      //     // console.info("Converted Requests:", requests);

      //     for (const request of requests) {
      //       if (request.hasOwnProperty("photo")) {
      //         await axios
      //           .post(`${API_URL}/sendPhoto`, request)
      //           .catch((error) => console.error(error));
      //       } else if (request.hasOwnProperty("voice")) {
      //         await axios
      //           .post(`${API_URL}/sendVoice`, request)
      //           .catch((error) => console.error(error));
      //       } else {
      //         await axios
      //           .post(`${API_URL}/sendMessage`, request)
      //           .catch((error) => console.error(error));
      //       }
      //     }
      //   }
      // }
    } catch (error) {
      console.error("Error handling webhook:", error.message);
    }
    res.send();
  }
});

const listener = app.listen(process.env.PORT, async () => {
  console.log(
    "Your Dialogflow integration server is listening on port " +
      listener.address().port
  );

  await setup();
});

module.exports = {
  telegramToDetectIntent,
  convertToTelegramMessage,
};
