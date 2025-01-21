require("dotenv").config();
const axios = require("axios");
const WebSocket = require("ws");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const uuid = require("uuid");

const SERVER_ADDRESS = process.env.COMFYUI_ADDRESS; // || "127.0.0.1:8188";
const CLIENT_ID = uuid.v4();

// Function to queue a prompt
async function queuePrompt(
  prompt,
  serverAddress = SERVER_ADDRESS,
  clientId = CLIENT_ID
) {
  const p = { prompt: prompt, client_id: clientId };
  const response = await axios.post(`http://${serverAddress}/prompt`, p, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
}

// Function to get an image
async function getImage(
  filename,
  subfolder,
  folderType,
  serverAddress = SERVER_ADDRESS
) {
  try {
    const data = { filename: filename, subfolder: subfolder, type: folderType };
    console.log(`Requesting image with data: ${JSON.stringify(data)}`);
    const response = await axios.get(`http://${serverAddress}/view`, {
      responseType: "arraybuffer",
      params: data,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching image: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${error.response.data}`);
      console.error(`Headers: ${JSON.stringify(error.response.headers)}`);
    }
    throw error;
  }
}

// Function to get history
async function getHistory(promptId, serverAddress = SERVER_ADDRESS) {
  const response = await axios.get(
    `http://${serverAddress}/history/${promptId}`
  );
  return response.data;
}

// Function to get images from WebSocket
async function getImages(
  ws,
  prompt,
  serverAddress = SERVER_ADDRESS,
  clientId = CLIENT_ID
) {
  const promptResponse = await queuePrompt(prompt, serverAddress, clientId);
  const promptId = promptResponse.prompt_id;
  const outputImages = {};

  let isProcessing = true;

  ws.on("message", (data) => {
    if (typeof data === "string") {
      const message = JSON.parse(data);
      // console.log("Received message:", message);
      if (message.type === "executed") {
        const messageData = message.data;
        if (messageData.prompt_id === promptId) {
          const filename = messageData.output.images[0].filename;
          console.log("Filename:", filename);
        }
      } else if (message.type === "executing") {
        const messageData = message.data;
        if (messageData.node === null && messageData.prompt_id === promptId) {
          ws.close();
          isProcessing = false;
        }
      }
    } else {
      const jsonString = data.toString("utf-8");
      const message = JSON.parse(jsonString);
      // console.log("Received message:", message);
      if (message.type === "executed") {
        const messageData = message.data;
        if (messageData.prompt_id === promptId) {
          const filename = messageData.output.images[0].filename;
          console.log("Filename:", filename);
        }
      } else if (message.type === "executing") {
        const messageData = message.data;
        if (messageData.node === null && messageData.prompt_id === promptId) {
          ws.close();
          isProcessing = false;
        }
      }
    }
  });

  while (isProcessing) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const history = (await getHistory(promptId))[promptId];
  for (const nodeId in history.outputs) {
    const nodeOutput = history.outputs[nodeId];
    const imagesOutput = [];
    if (nodeOutput.images) {
      for (const image of nodeOutput.images) {
        const imageData = await getImage(
          image.filename,
          image.subfolder,
          image.type
        );
        imagesOutput.push(imageData);
      }
    }
    outputImages[nodeId] = imagesOutput;
  }
  return outputImages;
}

async function getCustomAvatar(
  chatID,
  avatarType,
  personalInterest,
  textPrompt,
  serverAddress = SERVER_ADDRESS,
  clientId = CLIENT_ID
) {
  // Array of possible seeds
  // const seeds = [785790463864390]; // Replace this with all possible seeds

  // Select a random seed
  const seedNum = Math.floor(Math.random() * (10 ** 15 - 10 ** 14) + 10 ** 14);

  // Log the selected seed
  console.log(`Selected seed: ${seedNum}`);
  const prompt = {
    3: {
      inputs: {
        seed: seedNum,
        steps: 25,
        cfg: 7,
        sampler_name: "euler_ancestral",
        scheduler: "karras",
        denoise: 1,
        model: ["39", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["40", 0],
      },
      class_type: "KSampler",
    },
    4: {
      inputs: {
        ckpt_name: "sdXL_v10VAEFix.safetensors",
      },
      class_type: "CheckpointLoaderSimple",
    },
    6: {
      inputs: {
        text: textPrompt,
        clip: ["39", 1],
      },
      class_type: "CLIPTextEncode",
    },
    7: {
      inputs: {
        text: "low quality, blurry, deformed, watermark, text, signature, depth of field, photoreal, white background",
        clip: ["39", 1],
      },
      class_type: "CLIPTextEncode",
    },
    25: {
      inputs: {
        samples: ["3", 0],
        vae: ["4", 2],
      },
      class_type: "VAEDecode",
    },
    26: {
      inputs: {
        images: ["25", 0],
      },
      class_type: "PreviewImage",
    },
    38: {
      inputs: {
        filename_prefix: "pixelbuildings128-v1-raw-",
        images: ["25", 0],
      },
      class_type: "SaveImage",
    },
    39: {
      inputs: {
        lora_name: "pixel-art-xl-v1.1.safetensors",
        strength_model: 1,
        strength_clip: 1,
        model: ["4", 0],
        clip: ["4", 1],
      },
      class_type: "LoraLoader",
    },
    40: {
      inputs: {
        width: 1024,
        height: 1024,
        batch_size: 1,
      },
      class_type: "EmptyLatentImage",
    },
  };

  // (avatarName, tagline) = getAvatarNameAndTagline(avatarType, personalInterest) //api call to openAI

  async function getAvatarNameAndTagline(avatarType, personalInterest) {
    try {
      const prompt = `Generate a creative and appropriate avatar name and tagline for an avatar type '${avatarType}' with a personal interest in '${personalInterest}'. The name and tagline should be engaging, welcoming, and suitable for a university open house. Avoid any inappropriate, offensive, political, religious, or culturally sensitive content. Ensure the tone is professional yet friendly, aligning with an academic and inclusive environment. The tagline must be concise and within 50 characters.`;
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 50,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.API_KEY}`,
          },
        }
      );

      const result = response.data.choices[0].message.content
        .split("\n")
        .filter((line) => line.trim() !== "");

      console.log("Result:", result);
      console.log("Generated avatar name:", result[0].split(": ")[1]);
      console.log("Generated tagline:", result[1].split(": ")[1]);

      const avatarName = result[0].split(": ")[1] || avatarType;
      const tagline =
        result[1].split(": ")[1] || "Trailblazing a better world by design!";
      console.log(`Avatar Name: ${avatarName}`);
      console.log(`Tagline: ${tagline}`);
      return { avatarName, tagline };
    } catch (error) {
      console.error("Error generating avatar name and tagline:", error.message);
      throw error;
    }
  }
  //console.log("before getAvatarNameAndTagline");
  const { avatarName, tagline } = await getAvatarNameAndTagline(
    avatarType,
    personalInterest
  );

  let avatarPath;
  try {
    const ws = new WebSocket(`ws://${serverAddress}/ws?clientId=${clientId}`);
    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      ws.close();
    });
    const images = await getImages(ws, prompt, serverAddress, clientId);
    ws.close();
    console.log("websocket closed");

    const scriptDir = __dirname;
    const avatarFolder = path.join(scriptDir, "Avatars");
    if (!fs.existsSync(avatarFolder)) {
      fs.mkdirSync(avatarFolder);
    }

    for (const filename in images) {
      const imageData = images[filename];
      avatarPath = path.join(avatarFolder, `${chatID}_avatar.png`);
      await sharp(Buffer.from(imageData[0])).toFile(avatarPath);
    }
  } catch (error) {
    console.error("Error generating custom avatar:", error.message);
    throw error;
  }

  return { avatarName, tagline, avatarPath };
}

function getRandomAvatar(avatarType) {
  const avatarNames = [
    "Innovative engineer",
    "Interdisciplinary architect",
    "Collaborative designer",
    "Design-centric creator",
    "Tech-savvy developer",
    "Hands-on builder",
    "Creative innovator",
    "Problem-solving analyst",
    "Sustainable-minded planner",
    "Entrepreneurial visionary",
    "Adaptive learner",
    "Human-centered designer",
    "Project-driven manager",
    "Critical-thinking researcher",
    "Resilient problem-solver",
    "Experimental thinker",
    "Globally-aware strategist",
    "Digitally-literate technologist",
    "Visionary futurist",
    "Holistic systems-thinker",
    "Inclusive leader",
  ];
  const taglines = [
    "Building the future with innovation!",
    "Designing spaces that inspire!",
    "Crafting solutions with creativity!",
    "Bringing visionary ideas to life!",
    "Coding the blueprint of tomorrow!",
    "Constructing dreams with hands-on expertise!",
    "Pioneering breakthroughs in design and technology!",
    "Solving problems with precision and insight!",
    "Shaping sustainable futures with foresight!",
    "Leading the way with entrepreneurial spirit!",
    "Adapting to challenges with curiosity!",
    "Crafting solutions with creativity!",
    "Driving projects to success with leadership!",
    "Exploring new frontiers with critical thinking!",
    "Overcoming obstacles with resilience!",
    "Experimenting with bold ideas!",
    "Navigating global challenges with insight!",
    "Innovating with digital expertise!",
    "Envisioning tomorrow with creativity!",
    "Designing holistic solutions for complex problems!",
    "Trailblazing a better world by design!",
  ];

  const randomIndex = Math.floor(Math.random() * avatarNames.length);
  const avatarName = avatarNames[randomIndex];
  const tagline = taglines[randomIndex];

  const randomAvatarNumber = Math.floor(Math.random() * 25) + 1;
  const scriptDir = __dirname;
  const avatarBasePath = path.join(scriptDir, "Samples");
  const avatarPath = path.join(
    avatarBasePath,
    `${avatarType}_Sample${randomAvatarNumber}.png`
  );

  return { avatarName, tagline, avatarPath };
}

module.exports = {
  queuePrompt,
  getImage,
  getHistory,
  getImages,
  getCustomAvatar,
  getRandomAvatar,
};
