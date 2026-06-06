#!/usr/bin/env node

async function run() {
  const axiosPath = require.resolve("axios");
  const pinterestHtml = `
    <html>
      <body>
        <img src="https://i.pinimg.com/236x/aa/bb/cc/sample-one.jpg" />
        <img src="https://i.pinimg.com/236x/11/22/33/sample-two.jpg" />
        <img src="https://i.pinimg.com/236x/44/55/66/sample-three.webp" />
        <img src="https://i.pinimg.com/236x/77/88/99/sample-four.png" />
      </body>
    </html>
  `;
  const imageBinary = Buffer.from("fake-image-bytes");

  require.cache[axiosPath] = {
    id: axiosPath,
    filename: axiosPath,
    loaded: true,
    exports: {
      get: async (url, options = {}) => {
        const urlString = String(url);

        if (urlString.includes("pinterest.com/search/pins/")) {
          return { data: pinterestHtml };
        }

        if (urlString.startsWith("https://i.pinimg.com/")) {
          if (options.responseType !== "arraybuffer") {
            throw new Error("Expected arraybuffer responseType for image download");
          }

          return { data: imageBinary };
        }

        throw new Error(`Unexpected URL: ${urlString}`);
      },
    },
  };

  const CommandHandler = require("./handlers/commandHandler");
  const handler = new CommandHandler(null);

  const sentMessages = [];
  const fakeSock = {
    sendMessage: async (chatJid, content) => {
      sentMessages.push({ chatJid, content });
      return { key: { id: `mock-${sentMessages.length}` } };
    },
  };

  const response = await handler.sendPinterestImages(["Manali"], {
    reply: async () => {},
  });

  if (!response?.mediaList || response.mediaList.length !== 4) {
    throw new Error(`Expected 4 Pinterest images, got ${response?.mediaList?.length || 0}`);
  }

  const mediaItem = response.mediaList[0];

  const axios = require("axios");
  const resolved = await (async (mediaItemValue) => {
    if (mediaItemValue?.image?.url) {
      const imageResponse = await axios.get(mediaItemValue.image.url, {
        responseType: "arraybuffer",
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });

      return {
        image: Buffer.from(imageResponse.data),
        caption: mediaItemValue.caption,
      };
    }

    return mediaItemValue;
  })(mediaItem);

  await fakeSock.sendMessage("12345@s.whatsapp.net", resolved, {});

  console.log("Sent messages:", sentMessages.length);
  console.log("Content image is Buffer:", Buffer.isBuffer(sentMessages[0].content.image));
  console.log("Caption:", sentMessages[0].content.caption || "<none>");

  if (sentMessages.length !== 1) {
    throw new Error(`Expected one sent message in this focused test, got ${sentMessages.length}`);
  }

  if (!Buffer.isBuffer(sentMessages[0].content.image)) {
    throw new Error("Expected resolved Pinterest media to be sent as a Buffer");
  }

  if (sentMessages[0].content.image.toString() !== imageBinary.toString()) {
    throw new Error("Resolved image buffer did not match expected bytes");
  }

  console.log("✅ Pinterest send-path test passed");
}

run().catch((error) => {
  console.error("❌ Pinterest send-path test failed:", error.message);
  process.exitCode = 1;
});