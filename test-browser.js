const fs = require('fs');

console.log('🔍 Testing Browser Detection...\n');

// Check all possible browser locations
const possiblePaths = [
    '/usr/bin/chromium',                                              // Linux Chromium
    '/usr/bin/chromium-browser',                                      // Alternative Linux
    '/snap/bin/chromium',                                             // Snap Chromium
    '/usr/bin/google-chrome',                                         // Linux Chrome
    '/usr/bin/google-chrome-stable',                                  // Linux Chrome stable
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',  // macOS Chrome
    '/Applications/Chromium.app/Contents/MacOS/Chromium',            // macOS Chromium
];

console.log('🔍 Checking browser locations:\n');
let foundPath = null;
possiblePaths.forEach((path, index) => {
    const exists = fs.existsSync(path);
    const status = exists ? '✅' : '❌';
    const label = path.includes('Chromium') ? 'Chromium' : 'Chrome';
    console.log(`${index + 1}. ${status} ${label}: ${path}`);
    
    if (exists && !foundPath) {
        foundPath = path;
    }
});

console.log('\n📋 Browser Configuration:');
if (foundPath) {
    console.log('🎯 SELECTED:', foundPath);
    console.log('✅ Eden will use this browser');
} else {
    console.log('� SELECTED: Puppeteer bundled Chromium');
    console.log('✅ Eden will use the default bundled browser');
}

console.log('\n💡 NOTE: If you want to use a specific browser:');
console.log('   - Install Chromium: brew install chromium (macOS)');
console.log('   - Or install Chrome: Download from google.com/chrome');
console.log('   - The bot will auto-detect it on next start');

console.log('\n✅ Browser detection complete!');
