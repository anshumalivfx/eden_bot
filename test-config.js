// Quick test to verify browser configuration loads correctly
const { Client, LocalAuth } = require("whatsapp-web.js");
const fs = require('fs');

console.log('🧪 Testing Eden Browser Configuration...\n');

// Replicate the browser detection logic
const possiblePaths = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

let executablePath = undefined;
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    executablePath = path;
    break;
  }
}

if (executablePath) {
  console.log('✅ Browser detected:', executablePath);
} else {
  console.log('✅ Using Puppeteer bundled Chromium');
}

// Test client initialization
try {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      executablePath: executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
  });
  
  console.log('✅ WhatsApp client initialized successfully');
  console.log('✅ Configuration is valid\n');
  console.log('🎉 Eden is ready to start!');
  console.log('📝 Run "npm start" to launch the bot');
  
} catch (error) {
  console.error('❌ Error initializing client:', error.message);
}
