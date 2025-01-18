// const axios = require("axios");
// const {event_states} = require("./eventpass");
//
// const axios = require("axios");
// await sleep(3000)
//       await axios.post(`${API_URL}/sendMessage`, {
//         chat_id: chatId,
//         text: "With that, here are the events that are happening on today's Open House",
//         parse_mode: "HTML" // Enables bold and clean formatting
//         // text: "Oops, something went wrong while generating your card. Please try again later with /start.",
//       });
//       await showEvents(chatId)
//       await sleep(3000)
//       await axios.post(`${API_URL}/sendMessage`, {
//         chat_id: chatId,
//         text: "✨Now, I will help you to plan your schedule. Do you have an idea of what events you want to go today? I'll wait for you to decide :) ✨",
//         parse_mode: "HTML", // Enables bold and clean formatting
//         reply_markup: {
//       keyboard: [
//         [{ text: "Yes" }],
//         [{ text: "No" }],
//       ],
//       one_time_keyboard: true, // The keyboard disappears after selection
//       resize_keyboard: true // Resizes the keyboard for a better UI
//       }});
//     }
// case event_states.SELECT_INTEREST: // Questionaire or allow them to choose among the events
//       if (messageText.toLowerCase() === "yes") {
//         try {
//           // Reference the document for today's events
//           const eventsDoc = db.collection("events").doc(DATE);
//           const docSnapshot = await eventsDoc.get();
//           // Fetch and map the event names into inline buttons
//           if (docSnapshot.exists) {
//             const eventsDict = docSnapshot.data();
//             const inlineKeyboard = Object.keys(eventsDict).map((eventName, index) => [
//               {
//                 text: eventName,
//                 callback_data: `events_${index}`,
//               },
//             ]);
//             const maxButtonsPerPage = 10;
//             const pages = [];
//             for (let i = 0; i < inlineKeyboard.length; i += maxButtonsPerPage) {
//               pages.push(inlineKeyboard.slice(i, i + maxButtonsPerPage));
//             }
//             for (const page of pages) {
//               await axios.post(`${API_URL}/sendMessage`, {
//                 chat_id: chatId,
//                 text: "Which events are you interested in attending today? 🗓️",
//                 parse_mode: "HTML",
//                 reply_markup: {
//                   inline_keyboard: page,
//                 },
//               });
//             }
//           }
//           else {
//             await axios.post(`${API_URL}/sendMessage`, {
//               chat_id: chatId,
//               text: "There were no events found 🗓️",
//               parse_mode: "HTML"
//             })
//           }
//         }
//         catch (error) {
//           console.error("Error fetching or sending events:", error.message);
//
//           // Notify the user of an error
//           await axios.post(`${API_URL}/sendMessage`, {
//             chat_id: chatId,
//             text: "Oops! Something went wrong while fetching the events. Please try again later. ⚠️",
//             parse_mode: "HTML",
//           });
//         }
//       } else {
//         // Questionaire
//         await axios.post(`${API_URL}/sendMessage`, {
//           chat_id: chatId,
//           text: "Interests Poll",
//           parse_mode: "HTML" // Enables bold and clean formatting
//         });
//       }
//       user.state = event_states.FINISH; //temporary
//       break;