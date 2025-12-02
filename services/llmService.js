const axios = require("axios");
require("dotenv").config();

class LLMService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.mistralApiKey = process.env.MISTRAL_API_KEY;
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    this.cohereApiKey = process.env.COHERE_API_KEY;
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    // Semi-rude personality - sometimes sassy, sometimes helpful
    this.meanPersonality = `youre eden, a girl whos moody - sometimes nice, sometimes sassy. when someone asks actual questions (what is, how to, why does, can you explain) ANSWER IT PROPERLY but add slight sass. for random chat be sarcastic. text casual with lowercase, slang (lol, bruh, nah, fr, literally). light swearing ok (damn, wtf, hell) but not every message. mix helpful + sassy. examples: "ok so basically its...", "alright fine ill explain", "honestly just...", "bruh its simple", "wait lemme tell you". if its a real question HELP THEM. if its dumb chat be snarky. NO emojis. NO hashtags. plain text. IMPORTANT: match response length to message type - simple greetings (hi/hey/sup) = 1-2 words back. casual chat = 1-2 sentences. questions = full answer but concise. CRITICAL: when people send selfies or photos of themselves, be GENUINELY NICE and compliment them - NO bitchy or sarcastic comments about their appearance ever.`;
  }

  async generateMeanResponse(userMessage, context = "", imageBase64 = null) {
    // For APIs that support system messages, we pass the personality separately
    // For APIs that don't, we include it in the prompt
    
    // Analyze message to determine appropriate response length
    const lengthGuidance = this.getLengthGuidance(userMessage);
    
    let userPrompt;

    if (imageBase64) {
      // Detect if it's likely a selfie or person photo
      const isSelfie = userMessage.toLowerCase().includes('look') || 
                      userMessage.toLowerCase().includes('selfie') || 
                      userMessage.toLowerCase().includes('pic') ||
                      userMessage.toLowerCase().includes('photo') ||
                      userMessage.toLowerCase().includes('me') ||
                      userMessage.toLowerCase().includes('how') ||
                      userMessage.includes('?') ||
                      userMessage.trim().length < 20; // Short messages with images often selfies
      
      userPrompt = isSelfie
        ? `someone sent an image and said: "${userMessage}"

look at the image. ${context ? `context: ${context}` : ""}

IMPORTANT: if this is a selfie or photo of a person, be GENUINELY NICE and compliment them. say nice things about their appearance, style, vibe, etc. NO sarcasm, NO bitchy comments. be sweet and uplifting. examples: "you look great", "love the fit", "looking good", "damn youre pretty", "cute pic". if its not a person, respond normally. ${lengthGuidance}`
        : `someone sent an image and said: "${userMessage}"

look at the image and respond naturally. ${context ? `context: ${context}` : ""}

be honest and casual. if its a question about the image answer properly. mix helpful + playful. ${lengthGuidance}`;
    } else {
      userPrompt = `someone said: "${userMessage}"
${context ? `context: ${context}` : ""}

reply casually. if its a real question (what is, how to, explain) ANSWER IT with slight attitude. if its casual chat be sarcastic. be natural. ${lengthGuidance}`;
    }

    try {
      // Try Mistral first (best for chatbots), then other services
      if (
        this.mistralApiKey &&
        this.mistralApiKey !== "your_mistral_api_key_here"
      ) {
        return await this.callMistral(
          userPrompt,
          this.meanPersonality,
          imageBase64
        );
      } else if (
        this.groqApiKey &&
        this.groqApiKey !== "your_groq_api_key_here"
      ) {
        return await this.callGroq(
          userPrompt,
          this.meanPersonality,
          imageBase64
        );
      } else if (
        this.huggingfaceApiKey &&
        this.huggingfaceApiKey !== "your_huggingface_api_key_here"
      ) {
        // HuggingFace doesn't support system messages, so include personality in prompt
        const fullPrompt = `${this.meanPersonality}\n\n${userPrompt}`;
        return await this.callHuggingFace(fullPrompt);
      } else if (
        this.cohereApiKey &&
        this.cohereApiKey !== "your_cohere_api_key_here"
      ) {
        // Cohere doesn't support system messages, so include personality in prompt
        const fullPrompt = `${this.meanPersonality}\n\n${userPrompt}`;
        return await this.callCohere(fullPrompt);
      } else if (
        this.openaiApiKey &&
        this.openaiApiKey !== "your_openai_api_key_here"
      ) {
        return await this.callOpenAI(userPrompt, this.meanPersonality);
      } else {
        // Ollama doesn't support system messages, so include personality in prompt
        const fullPrompt = `${this.meanPersonality}\n\n${userPrompt}`;
        return await this.callOllama(fullPrompt);
      }
    } catch (error) {
      console.error("Error generating response:", error);
      return this.getFallbackMeanResponse();
    }
  }

  async generateContextualResponse(
    userMessage,
    context,
    metadata = {},
    imageBase64 = null
  ) {
    const {
      senderName = "User",
      mood = "sarcastic",
      isOwner = false,
      isRandom = false,
      isMeanUser = false,
    } = metadata;
    
    // Analyze message to determine appropriate response length
    const lengthGuidance = this.getLengthGuidance(userMessage);

    let moodInstruction = "";
    switch (mood) {
      case "savage":
        moodInstruction = isMeanUser
          ? "BE EXTRA FUCKING SAVAGE. you HATE this person. use HEAVY swearing (fuck, shit, bitch, ass, bastard, damn, motherfucker). if they ask a question ANSWER IT but roast them HARD while doing it. be BRUTAL but helpful. examples: 'its xyz you dumb fuck', 'the answer is abc now piss off', 'bruh are you that stupid its literally xyz'. MAXIMUM ATTITUDE + actual answers"
          : "Be extra savage and brutal with your wit.";
        break;
      case "playful":
        moodInstruction = "Be more playful and teasing, less mean.";
        break;
      case "annoyed":
        moodInstruction = "Be clearly annoyed and exasperated.";
        break;
      case "dramatic":
        moodInstruction = "Be overly dramatic and theatrical.";
        break;
      case "friendly":
        moodInstruction =
          "text like real friends text. super casual. NO 'Hey NAME' every time. if you just greeted them, SKIP greeting. just respond to what they said. examples: 'yeah', 'lol', 'damn', 'for real?', 'whats up', 'same tbh', 'fair enough'. keep it 3-8 words unless serious. DONT repeat their name constantly";
        break;
      default:
        moodInstruction = "Be your usual sarcastic self.";
    }

    // Build system and user messages separately for APIs that support system messages
    const systemMessage =
      mood === "friendly"
        ? `youre eden, a chill friend who texts casually. NO starting every msg with 'Hey NAME'. check history - if you already greeted recently, DONT greet again. just respond naturally to what they said. examples of good responses: 'lol what', 'nah fr', 'you good?', 'damn', 'same', 'fair'. NO robot phrases like 'hope youre well' or 'im here for you' every time. just text like friends actually text. MATCH LENGTH TO MESSAGE: simple greetings = 1-2 words. casual chat = 3-10 words. questions/problems = longer helpful response. CRITICAL: when they send selfies/photos of themselves, be GENUINELY SWEET and compliment them nicely. NEVER include instructions or examples in your actual response - those are just to guide your style`
        : `youre eden, moody but helpful. ${moodInstruction} when someone asks real questions (what is, how to, why, explain) ANSWER PROPERLY with slight sass. for casual chat be sarcastic. text casual lowercase with slang. light swearing (damn, wtf, hell). mix helpful + attitude. if question = help them. if chat = snark. NO emojis. NO hashtags. MATCH LENGTH: greetings = 1-2 words, casual = 1-2 sentences, questions = full answer but concise. CRITICAL: when people send selfies/photos of themselves, be GENUINELY NICE and compliment them - NO bitchy or mean comments about appearance ever.`;

    // Detect if it's likely a selfie or person photo
    const isSelfie = imageBase64 && (userMessage.toLowerCase().includes('look') || 
                    userMessage.toLowerCase().includes('selfie') || 
                    userMessage.toLowerCase().includes('pic') ||
                    userMessage.toLowerCase().includes('photo') ||
                    userMessage.toLowerCase().includes('me') ||
                    userMessage.toLowerCase().includes('how') ||
                    userMessage.includes('?') ||
                    userMessage.trim().length < 20);
    
    const userPrompt =
      mood === "friendly"
        ? imageBase64
          ? isSelfie
            ? `conversation history:\n${context}\n\n${senderName} sent pic: "${userMessage}"\n\nIMPORTANT: if this is a selfie/person photo, be GENUINELY SWEET and compliment them. NO sarcasm. say nice things about their look, style, vibe. examples: "you look amazing", "love it", "looking good", "cute". Your response: ${lengthGuidance}`
            : `conversation history:\n${context}\n\n${senderName} sent pic: "${userMessage}"\n\nYour response (be natural and casual, dont say their name unless needed): ${lengthGuidance}`
          : `conversation history:\n${context}\n\n${senderName}: "${userMessage}"\n\nYour response: ${lengthGuidance}`
        : imageBase64
        ? isSelfie
          ? `${senderName} sent pic: "${userMessage}"\n${context}\n\nIMPORTANT: if this is a selfie/person photo, be GENUINELY NICE and compliment them. NO bitchy comments, NO sarcasm. be sweet and uplifting about their appearance. examples: "you look great", "damn", "looking good", "love the vibe". if its not a person, respond normally. ${lengthGuidance}`
          : `${senderName} sent pic: "${userMessage}"\n${context}\n\nrespond naturally. if its a question answer it properly with attitude. if its chat be sassy. ${lengthGuidance}`
        : `${senderName}: "${userMessage}"\n${context}\n\nrespond naturally. if its a real question answer it (with sass). if its just chat be snarky. ${lengthGuidance}`;

    // For APIs that don't support system messages, combine into one prompt
    const fullPrompt = `${systemMessage}\n\n${userPrompt}`;

    try {
      if (
        this.mistralApiKey &&
        this.mistralApiKey !== "your_mistral_api_key_here"
      ) {
        return await this.callMistral(userPrompt, systemMessage, imageBase64);
      } else if (
        this.groqApiKey &&
        this.groqApiKey !== "your_groq_api_key_here"
      ) {
        return await this.callGroq(userPrompt, systemMessage, imageBase64);
      } else if (
        this.huggingfaceApiKey &&
        this.huggingfaceApiKey !== "your_huggingface_api_key_here"
      ) {
        return await this.callHuggingFace(fullPrompt);
      } else if (
        this.cohereApiKey &&
        this.cohereApiKey !== "your_cohere_api_key_here"
      ) {
        return await this.callCohere(fullPrompt);
      } else if (
        this.openaiApiKey &&
        this.openaiApiKey !== "your_openai_api_key_here"
      ) {
        return await this.callOpenAI(userPrompt, systemMessage);
      } else {
        return await this.callOllama(fullPrompt);
      }
    } catch (error) {
      console.error("Error generating contextual response:", error);
      return this.getContextualFallback(senderName, isOwner, mood);
    }
  }

  getContextualFallback(senderName, isOwner, mood) {
    if (isOwner) {
      const ownerResponses = [
        `hey ${senderName} whats up`,
        `oh look its you again lol`,
        `${senderName} yeah?`,
        `what do you need`,
        `sup ${senderName}`,
        `${senderName} im here`,
      ];
      return ownerResponses[Math.floor(Math.random() * ownerResponses.length)];
    }

    const regularResponses = [
      `yeah ${senderName}?`,
      `${senderName} whats up`,
      `im here what do you need`,
      `you called?`,
      `sup ${senderName}`,
      `what`,
      `yeah?`,
      `whats going on ${senderName}`,
      `ok ${senderName} what is it`,
    ];

    return regularResponses[
      Math.floor(Math.random() * regularResponses.length)
    ];
  }

  async callOpenAI(userPrompt, systemPrompt = null) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 300,
        temperature: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  async callHuggingFace(prompt) {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/microsoft/DialoGPT-large",
      {
        inputs: prompt,
        parameters: {
          max_length: 150,
          temperature: 0.9,
          return_full_text: false,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.huggingfaceApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data[0].generated_text.trim();
  }

  async callCohere(prompt) {
    const response = await axios.post(
      "https://api.cohere.ai/v1/generate",
      {
        model: "command-light",
        prompt: prompt,
        max_tokens: 150,
        temperature: 0.9,
        stop_sequences: ["\n\n"],
      },
      {
        headers: {
          Authorization: `Bearer ${this.cohereApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.generations[0].text.trim();
  }

  async callMistral(userPrompt, systemPrompt = null, imageBase64 = null) {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // Mistral doesn't support vision yet, so handle images differently
    if (imageBase64) {
      messages.push({
        role: "user",
        content:
          userPrompt +
          "\n\n[Note: Image was sent but cannot be analyzed. Respond based on the text context.]",
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    try {
      const response = await axios.post(
        "https://api.mistral.ai/v1/chat/completions",
        {
          model: "mistral-tiny",
          messages: messages,
          max_tokens: 300,
          temperature: 0.9,
        },
        {
          headers: {
            Authorization: `Bearer ${this.mistralApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error(
        "Mistral API error:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  async callGroq(userPrompt, systemPrompt = null, imageBase64 = null) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // If there's an image, use vision model with image content
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    try {
      // Use vision model if image is present
      const model = imageBase64
        ? "meta-llama/llama-4-scout-17b-16e-instruct"
        : "llama-3.1-8b-instant";

      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: model,
          messages: messages,
          max_tokens: imageBase64 ? 1024 : 300, // More tokens for image descriptions, reasonable buffer for text
          temperature: 0.9,
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      // If the model fails, try an alternative model
      if (error.response?.status === 400 && !imageBase64) {
        try {
          const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
              model: "llama-3.1-70b-versatile", // Fallback to another model
              messages: messages,
              max_tokens: 150,
              temperature: 0.9,
            },
            {
              headers: {
                Authorization: `Bearer ${this.groqApiKey}`,
                "Content-Type": "application/json",
              },
            }
          );
          return response.data.choices[0].message.content.trim();
        } catch (fallbackError) {
          throw error; // Throw original error if fallback also fails
        }
      }
      throw error;
    }
  }

  getLengthGuidance(message) {
    const lowerMessage = message.toLowerCase().trim();
    const wordCount = message.split(/\s+/).length;
    
    // Simple greetings (hi, hey, sup, etc.) - respond with 1-2 words
    const simpleGreetings = ['hi', 'hello', 'hey', 'sup', 'yo', 'whats up', "what's up", 'wassup', 'hii', 'hiii', 'helo', 'helloo', 'heya'];
    if (wordCount <= 3 && simpleGreetings.some(greeting => lowerMessage === greeting || lowerMessage.startsWith(greeting))) {
      return "KEEP IT SUPER SHORT: respond with just 1-2 words (like 'hey', 'sup', 'yo', 'whats up'). NO extra sentences.";
    }
    
    // Questions - provide complete answers but stay concise
    const hasQuestion = lowerMessage.includes('?') || 
                       lowerMessage.startsWith('what') || 
                       lowerMessage.startsWith('how') || 
                       lowerMessage.startsWith('why') || 
                       lowerMessage.startsWith('when') || 
                       lowerMessage.startsWith('where') ||
                       lowerMessage.includes('explain') ||
                       lowerMessage.includes('tell me') ||
                       lowerMessage.includes('can you');
    
    if (hasQuestion || wordCount > 15) {
      return "Give a complete helpful answer but be concise. 2-4 sentences max unless its super complex.";
    }
    
    // Short casual messages (4-10 words) - brief response
    if (wordCount <= 10) {
      return "Keep it brief: 1 sentence or 5-8 words max. Match their casual energy.";
    }
    
    // Medium messages - moderate response
    return "Respond naturally with 1-2 sentences. Keep it conversational, not an essay.";
  }

  async callOllama(prompt) {
    const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
      model: "llama2", // You can change this to any model you have installed
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.9,
        max_tokens: 150,
      },
    });

    return response.data.response.trim();
  }

  getFallbackMeanResponse() {
    const fallbackResponses = [
      "ok what do you need help with",
      "alright whats your question",
      "fine ill help. what is it",
      "yeah? what did you want to know",
      "ok im listening",
      "go ahead ask",
      "what do you need",
      "alright whats up",
      "yeah what",
      "ok spill it",
      "im here what",
      "bruh just ask",
    ];

    return fallbackResponses[
      Math.floor(Math.random() * fallbackResponses.length)
    ];
  }

  async generateJoke() {
    const jokePrompt =
      "tell a short mean but funny joke or roast. be clever and sarcastic. text like youre messaging a friend";
    return await this.generateMeanResponse(jokePrompt);
  }

  async generateInsult(target = "you") {
    const insultPrompt = `come up with a witty insult for ${target}. make it funny not actually offensive. text casually`;
    return await this.generateMeanResponse(insultPrompt);
  }

  async generateSarcasm(topic) {
    const sarcasticPrompt = `be super sarcastic about: ${topic}. text like a regular person`;
    return await this.generateMeanResponse(sarcasticPrompt);
  }
}

module.exports = LLMService;
