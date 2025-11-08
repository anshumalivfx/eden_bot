const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

class ImageService {
    constructor() {
        this.freeApis = {
            // Pollinations AI - Free and no API key required
            pollinations: {
                url: 'https://image.pollinations.ai/prompt/',
                needsKey: false,
                method: 'GET'
            },
            
            // Hugging Face Inference API - Free tier
            huggingface: {
                url: 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
                needsKey: true,
                method: 'POST'
            },
            
            // DeepAI - Free tier (limited)
            deepai: {
                url: 'https://api.deepai.org/api/text2img',
                needsKey: true,
                method: 'POST'
            }
        };

        this.imageStyles = {
            realistic: 'photorealistic, high quality, detailed',
            anime: 'anime style, manga, japanese animation',
            cartoon: 'cartoon style, animated, colorful',
            artistic: 'digital art, artistic, creative',
            cyberpunk: 'cyberpunk, neon, futuristic, dark',
            fantasy: 'fantasy art, magical, mystical',
            minimalist: 'minimalist, simple, clean design',
            vintage: 'vintage, retro, old style',
            abstract: 'abstract art, geometric, modern',
            watercolor: 'watercolor painting, soft, artistic'
        };
    }

    /**
     * Generate image from text prompt
     */
    async generateImage(prompt, style = null, apiProvider = 'pollinations') {
        try {
            // Add style to prompt if specified
            let enhancedPrompt = prompt;
            if (style && this.imageStyles[style]) {
                enhancedPrompt = `${prompt}, ${this.imageStyles[style]}`;
            }

            console.log(`🎨 Generating image with ${apiProvider}: "${enhancedPrompt}"`);

            let imageBuffer;
            switch (apiProvider) {
                case 'pollinations':
                    imageBuffer = await this.generateWithPollinations(enhancedPrompt);
                    break;
                case 'huggingface':
                    imageBuffer = await this.generateWithHuggingFace(enhancedPrompt);
                    break;
                default:
                    imageBuffer = await this.generateWithPollinations(enhancedPrompt);
            }

            // Save to temp file
            const filename = `ai_image_${Date.now()}.png`;
            const filepath = path.join(__dirname, '../temp', filename);
            
            // Ensure temp directory exists
            const tempDir = path.dirname(filepath);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            fs.writeFileSync(filepath, imageBuffer);

            return {
                filepath,
                prompt: enhancedPrompt,
                originalPrompt: prompt,
                style: style || 'default',
                apiProvider,
                cleanup: () => {
                    try {
                        if (fs.existsSync(filepath)) {
                            fs.unlinkSync(filepath);
                        }
                    } catch (e) {
                        console.warn('Failed to cleanup image file:', e.message);
                    }
                }
            };

        } catch (error) {
            console.error('Image generation error:', error);
            throw error;
        }
    }

    /**
     * Generate image using Pollinations AI (free, no API key)
     */
    async generateWithPollinations(prompt) {
        try {
            // Encode prompt for URL
            const encodedPrompt = encodeURIComponent(prompt);
            const url = `${this.freeApis.pollinations.url}${encodedPrompt}?width=512&height=512&seed=${Math.floor(Math.random() * 1000000)}`;
            
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Eden-WhatsApp-Bot/1.0'
                }
            });

            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Pollinations API error: ${error.message}`);
        }
    }

    /**
     * Generate image using Hugging Face (requires API key)
     */
    async generateWithHuggingFace(prompt) {
        const apiKey = process.env.HUGGINGFACE_API_KEY;
        if (!apiKey) {
            throw new Error('Hugging Face API key not found in environment variables');
        }

        try {
            const response = await axios.post(
                this.freeApis.huggingface.url,
                { inputs: prompt },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'arraybuffer',
                    timeout: 30000
                }
            );

            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Hugging Face API error: ${error.message}`);
        }
    }

    /**
     * Modify existing image with new prompt (Image-to-Image)
     */
    async modifyImage(imagePath, prompt, style = null, strength = 0.7) {
        try {
            console.log(`🔄 Modifying image: "${prompt}"`);

            // For now, we'll create a new image based on the prompt
            // Real img2img would require more advanced APIs
            const combinedPrompt = `modify image, ${prompt}`;
            
            return await this.generateImage(combinedPrompt, style);

        } catch (error) {
            console.error('Image modification error:', error);
            throw error;
        }
    }

    /**
     * Get available image styles
     */
    getImageStyles() {
        return Object.keys(this.imageStyles).map(key => ({
            name: key,
            description: this.imageStyles[key]
        }));
    }

    /**
     * Clean and prepare prompt for image generation
     */
    preparePrompt(prompt) {
        // Remove commands and clean text
        let cleanPrompt = prompt.replace(/^-\w+\s+/, '').trim();
        
        // Remove inappropriate content keywords (basic filtering)
        const bannedWords = ['nude', 'nsfw', 'explicit', 'inappropriate'];
        bannedWords.forEach(word => {
            cleanPrompt = cleanPrompt.replace(new RegExp(word, 'gi'), '');
        });

        // Limit length
        if (cleanPrompt.length > 200) {
            cleanPrompt = cleanPrompt.substring(0, 197) + '...';
        }

        return cleanPrompt.trim() || 'abstract art';
    }

    /**
     * Get Eden's sassy responses for image generation
     */
    getImageResponses() {
        return [
            "🎨 Fine, I'll create your masterpiece... This better be worth my processing power.",
            "🖼️ Oh great, now I'm an artist too? Let me paint you something... mediocre.",
            "🎭 Generating your vision... Prepare to be underwhelmed by my artistic genius.",
            "🖌️ Hold on, let me channel my inner Picasso... or at least try to.",
            "🎪 Welcome to Eden's AI Art Gallery! Featuring: your questionable taste in prompts.",
            "🎨 Creating visual magic from your text... You're welcome for this service.",
            "🖼️ Converting your imagination into pixels... Let's see how this turns out.",
            "🎭 And now, for my next trick... turning your words into probably disappointing art!"
        ];
    }

    /**
     * Get error responses for failed image generation
     */
    getImageErrorResponses() {
        return [
            "🎨 Well, that didn't work. Your prompt broke my artistic vision. Try something less... you.",
            "🖼️ Image generation failed. Maybe try with a prompt that makes sense? 🤷‍♀️",
            "🎭 I tried to create your masterpiece, but even AI has limits. Sorry not sorry.",
            "🖌️ Something went wrong with the art creation. Probably your fault somehow.",
            "🎪 Art generation crashed. Even my algorithms have standards, apparently."
        ];
    }

    /**
     * Check if API is available
     */
    async checkApiAvailability(provider = 'pollinations') {
        try {
            if (provider === 'pollinations') {
                const testUrl = `${this.freeApis.pollinations.url}test?width=64&height=64`;
                await axios.get(testUrl, { timeout: 10000 });
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }
}

module.exports = new ImageService();
