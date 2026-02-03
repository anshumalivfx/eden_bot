#!/usr/bin/env node

// Test faster-whisper Installation
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

console.log("🎤 Testing faster-whisper Installation...\n");

async function testWhisper() {
  try {
    // Test 1: Check if faster-whisper is installed
    console.log("1️⃣ Checking faster-whisper installation...");
    const testImport = `python3 -c "from faster_whisper import WhisperModel; print('OK')"`;

    try {
      const { stdout } = await execAsync(testImport);
      if (stdout.trim() === "OK") {
        console.log("   ✅ faster-whisper is installed\n");
      }
    } catch (error) {
      console.log("   ❌ faster-whisper is NOT installed\n");
      console.log("   Install with: ./install-whisper.sh\n");
      console.log("   Or manually: pip3 install faster-whisper\n");
      console.log(
        "   💡 faster-whisper is compatible with Python 3.12 and 4x faster!\n",
      );
      return;
    }

    // Test 2: Check faster-whisper version
    console.log("2️⃣ Checking faster-whisper version...");
    const versionCmd = `python3 -c "import faster_whisper; print(faster_whisper.__version__)"`;

    try {
      const { stdout } = await execAsync(versionCmd);
      console.log(`   ✅ faster-whisper version: ${stdout.trim()}\n`);
    } catch (error) {
      console.log("   ⚠️  Could not determine version\n");
    }

    // Test 3: List available models
    console.log("3️⃣ Available Whisper models:");
    console.log("   tiny, base, small, medium, large-v1, large-v2, large-v3\n");

    // Test 4: Check model download status
    console.log("4️⃣ Checking downloaded models...");
    const checkModels = `python3 -c "
import os
import whisper
cache_dir = os.path.join(os.path.expanduser('~'), '.cache', 'whisper')
if os.path.exists(cache_dir):
    models = [f for f in os.listdir(cache_dir) if f.endswith('.pt')]
    if models:
        print('Downloaded: ' + ', '.join([m.replace('.pt', '') for m in models]))
    else:
        print('None (will download on first use)')
else:
    print('None (will download on first use)')
"`;

    try {
      const { stdout } = await execAsync(checkModels);
      console.log(`   ${stdout.trim()}\n`);
    } catch (error) {
      console.log("   ⚠️  Could not check models\n");
    }

    // Test 5: Configuration
    console.log("5️⃣ Current configuration (.env):");
    const fs = require("fs");
    const envPath = require("path").join(__dirname, ".env");

    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      const transcriptionMatch = envContent.match(
        /DUB_TRANSCRIPTION_ENGINE=(\w+)/,
      );
      const ttsMatch = envContent.match(/DUB_TTS_ENGINE=(\w+)/);

      if (transcriptionMatch) {
        console.log(`   Transcription: ${transcriptionMatch[1]}`);
      } else {
        console.log(`   Transcription: whisper-local (default)`);
      }

      if (ttsMatch) {
        console.log(`   TTS Engine: ${ttsMatch[1]}`);
      }
      console.log("");
    }

    // Summary
    console.log("✅ Whisper is ready to use!\n");
    console.log("📝 Test with:");
    console.log("   Send a voice note and reply: -dub hindi\n");
    console.log("💡 Tips:");
    console.log("   • First use will download model (~142 MB for base)");
    console.log("   • Long audio (>10 min) automatically uses local Whisper");
    console.log(
      "   • Short audio (<10 min) uses Groq (faster) with fallback\n",
    );
    console.log("📚 See WHISPER_SETUP.md for more info\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testWhisper();
