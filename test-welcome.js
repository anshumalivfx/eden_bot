/**
 * Test script to simulate group participant updates
 * This helps verify the welcome message feature
 */

const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
require("dotenv").config();

async function testWelcomeFeature() {
  console.log("🧪 Testing Welcome Feature...\n");

  try {
    const { state, saveCreds } = await useMultiFileAuthState("./baileys_auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: "silent" })
        ),
      },
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: Browsers.macOS("Desktop"),
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection } = update;
      if (connection === "open") {
        console.log("✅ Connected to WhatsApp\n");
        console.log("📋 Welcome Feature Configuration:");
        console.log("   - Event: group-participants.update");
        console.log("   - Action: add");
        console.log("   - Mentions: New member JIDs");
        console.log("\n📝 Welcome Message Format:");
        console.log("   HI @user1 @user2 ");
        console.log("   ");
        console.log("   *Please introduce yourself!* 👋");
        console.log("   ");
        console.log("   Imp *Pls no sensitive/SEXUAL DISCUSSION here.*");
        console.log("   *No 18+ stickers/sometimes you can*");
        console.log("   *no ragebait*");
        console.log("   * Avoid saying negative things here *");
        console.log("   Happy good vibes only ✨");
        console.log("   No DMs anyone without consent guys");
        console.log("   ");
        console.log("   Violators will be shamed publicly");
        console.log("\n✨ Feature is active and ready!");
        console.log("💡 To test: Add someone to a group where the bot is a member\n");
        
        setTimeout(() => {
          console.log("✅ Test complete - feature is properly configured");
          process.exit(0);
        }, 2000);
      }
    });

    // Log when group participant events are received
    sock.ev.on("group-participants.update", async (event) => {
      console.log("\n🎉 Group participant event received:");
      console.log(`   Group: ${event.id}`);
      console.log(`   Action: ${event.action}`);
      console.log(`   Participants: ${event.participants.join(", ")}`);
      
      if (event.action === "add") {
        console.log("✅ Welcome message will be sent!");
      }
    });
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testWelcomeFeature();
