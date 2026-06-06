#!/usr/bin/env node

require("dotenv").config();

const path = require("path");

async function run() {
  const axiosPath = require.resolve("axios");
  const mockHtml = `
    <html>
      <body>
        <img src="https://i.pinimg.com/236x/aa/bb/cc/sample-one.jpg" />
        <script>
          window.__data = "https://i.pinimg.com/236x/dd/ee/ff/sample-two.webp";
        </script>
      </body>
    </html>
  `;

  require.cache[axiosPath] = {
    id: axiosPath,
    filename: axiosPath,
    loaded: true,
    exports: {
      get: async (url) => {
        if (!String(url).includes("pinterest.com/search/pins/")) {
          throw new Error(`Unexpected URL: ${url}`);
        }

        return {
          data: mockHtml,
        };
      },
    },
  };

  const CommandHandler = require("./handlers/commandHandler");

  const handler = new CommandHandler(null);

  const replies = [];
  const message = {
    reply: async (text) => {
      replies.push(text);
    },
  };

  const result = await handler.sendPinterestImages(["Manali"], message);

  console.log("Replies:", replies);
  console.log("Result media count:", result?.mediaList?.length || 0);
  console.log("First image URL:", result?.mediaList?.[0]?.image?.url || "<missing>");

  if (!result?.mediaList || result.mediaList.length !== 2) {
    throw new Error(`Expected 2 Pinterest images, got ${result?.mediaList?.length || 0}`);
  }

  if (!String(result.mediaList[0].image.url).startsWith("https://i.pinimg.com/")) {
    throw new Error("First image URL was not a Pinterest URL");
  }

  console.log("✅ Pinterest command test passed");
}

run().catch((error) => {
  console.error("❌ Pinterest command test failed:", error.message);
  process.exitCode = 1;
});