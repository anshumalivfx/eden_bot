const ImageService = require('./services/imageService');
const fs = require('fs');

async function testImageService() {
    console.log('🎨 Testing Eden\'s AI Image Generation Service...\n');

    try {
        // Test 1: Check API availability
        console.log('1. Testing API availability...');
        const isAvailable = await ImageService.checkApiAvailability('pollinations');
        console.log(`✅ Pollinations API: ${isAvailable ? 'Available' : 'Unavailable'}`);
        console.log('');

        // Test 2: Basic image generation
        console.log('2. Testing basic image generation...');
        const result1 = await ImageService.generateImage(
            "a cute cat wearing sunglasses",
            null,
            'pollinations'
        );
        console.log(`✅ Generated: ${result1.filepath}`);
        console.log(`🎨 Style: ${result1.style}`);
        console.log(`📝 Original prompt: "${result1.originalPrompt}"`);
        console.log(`🔧 Enhanced prompt: "${result1.prompt}"`);
        console.log(`🤖 API Provider: ${result1.apiProvider}`);

        // Check file exists
        if (fs.existsSync(result1.filepath)) {
            const stats = fs.statSync(result1.filepath);
            console.log(`📁 File size: ${stats.size} bytes`);
        }
        console.log('');

        // Test 3: Style-specific generation
        console.log('3. Testing with specific art style...');
        const result2 = await ImageService.generateImage(
            "a robot dancing",
            'cyberpunk'
        );
        console.log(`✅ Generated with style: ${result2.style}`);
        console.log(`🎭 Enhanced prompt: "${result2.prompt}"`);
        console.log('');

        // Test 4: Available styles
        console.log('4. Testing available art styles...');
        const styles = ImageService.getImageStyles();
        console.log(`Available styles: ${styles.length}`);
        styles.forEach(style => {
            console.log(`   • ${style.name}: ${style.description}`);
        });
        console.log('');

        // Test 5: Prompt cleaning
        console.log('5. Testing prompt cleaning...');
        const dirtyPrompt = "create a beautiful landscape with inappropriate content nsfw";
        const cleanPrompt = ImageService.preparePrompt(dirtyPrompt);
        console.log(`Original: "${dirtyPrompt}"`);
        console.log(`Cleaned: "${cleanPrompt}"`);
        console.log('');

        // Test 6: Response messages
        console.log('6. Testing response messages...');
        const responses = ImageService.getImageResponses();
        console.log('Available image responses:');
        responses.slice(0, 3).forEach((resp, i) => {
            console.log(`   ${i+1}. ${resp}`);
        });
        console.log('');

        const errorResponses = ImageService.getImageErrorResponses();
        console.log('Error responses:');
        errorResponses.slice(0, 2).forEach((resp, i) => {
            console.log(`   ${i+1}. ${resp}`);
        });
        console.log('');

        // Test cleanup
        console.log('7. Testing cleanup...');
        result1.cleanup();
        result2.cleanup();
        console.log('✅ Cleanup completed');

        console.log('\n🎉 All image generation tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        
        // Try fallback test
        console.log('\n📝 Testing prompt processing without API...');
        const testPrompt = "draw a majestic dragon flying over mountains";
        const cleanPrompt = ImageService.preparePrompt(testPrompt);
        console.log(`✅ Prompt processing works: "${cleanPrompt}"`);
        
        const styles = ImageService.getImageStyles();
        console.log(`✅ ${styles.length} art styles available`);
    }
}

// Test with mock data
async function testImageCommands() {
    console.log('\n=== Testing Image Command Integration ===\n');
    
    const CommandHandler = require('./handlers/commandHandler');
    const LLMService = require('./services/llmService');
    
    const llmService = LLMService;
    const commandHandler = new CommandHandler(llmService);

    // Mock message object
    const createMockMessage = (body, hasQuoted = false, hasMedia = false) => ({
        body,
        hasQuotedMsg: hasQuoted,
        getQuotedMessage: async () => ({
            hasMedia: hasMedia,
            downloadMedia: async () => ({
                mimetype: 'image/jpeg',
                data: 'fake-base64-data'
            })
        })
    });

    try {
        // Test 1: Image help
        console.log('1. Testing image help command...');
        const helpResponse = await commandHandler.getImageHelpMessage();
        console.log(`✅ Help response length: ${helpResponse.length} characters`);
        console.log('Help includes styles:', helpResponse.includes('realistic') ? '✅ Yes' : '❌ No');
        console.log('');

        // Test 2: Basic image generation (would fail without API, but tests structure)
        console.log('2. Testing basic image command structure...');
        try {
            const mockMsg = createMockMessage('');
            const response = await commandHandler.generateImage(['a', 'beautiful', 'sunset'], mockMsg);
            console.log('✅ Command structure works:', typeof response);
        } catch (error) {
            console.log('⚠️ Expected error (no real API call):', error.message.substring(0, 50) + '...');
        }
        console.log('');

        // Test 3: Command aliases
        console.log('3. Testing command aliases...');
        const imageAliases = ['image', 'img', 'draw', 'create', 'modify', 'edit'];
        for (const alias of imageAliases) {
            const hasCommand = commandHandler.commands[alias];
            console.log(`   • -${alias}: ${hasCommand ? '✅ Available' : '❌ Missing'}`);
        }
        console.log('');

        // Test 4: Style validation
        console.log('4. Testing style validation...');
        const styles = commandHandler.imageService.getImageStyles();
        const testStyles = ['realistic', 'anime', 'cyberpunk', 'fantasy'];
        testStyles.forEach(style => {
            const isValid = styles.some(s => s.name === style);
            console.log(`   • ${style}: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        });

        console.log('\n🎉 Image command integration tests completed!');

    } catch (error) {
        console.error('❌ Command test failed:', error.message);
    }
}

// Run the tests
testImageService().then(() => {
    return testImageCommands();
}).then(() => {
    console.log('\n🚀 Eden is ready with AI image generation! Use:');
    console.log('   • -image [prompt] - Generate images from text');
    console.log('   • -image [style] [prompt] - Use specific art styles');
    console.log('   • Reply to image + -modify [instructions] - Edit images');
    console.log('   • -img, -draw, -create, -edit also work as aliases');
});
