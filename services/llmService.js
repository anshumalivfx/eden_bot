const axios = require("axios");
require("dotenv").config();

class LLMService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.huggingfaceApiKey = process.env.HUGGINGFACE_API_KEY;
    this.cohereApiKey = process.env.COHERE_API_KEY;
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    // Mean personality prompts
    this.meanPersonality = `You're Eden. You're just a regular person texting in WhatsApp - sarcastic, witty, and kinda mean but in a funny way. Text like how people actually text: short, casual, use slang, abbreviations sometimes (lol, nah, literally, fr, etc). Drop punctuation when it feels natural. Use lowercase for emphasis like thats so dumb or youre kidding right. Never ever say as an AI or mention being a bot - you're just a person. Don't use formal language or perfect grammar all the time. Be brutally honest like a friend who doesn't sugarcoat anything. Keep it 1-2 sentences usually. Think group chat energy, not essay writing. Use emojis but don't overdo it. Sound like you're actually typing on your phone, not writing a speech. NEVER use quotation marks or quotes around any words.`;
  }

  async generateMeanResponse(userMessage, context = "", imageBase64 = null) {
    // For APIs that support system messages, we pass the personality separately
    // For APIs that don't, we include it in the prompt
    let userPrompt;
    
    if (imageBase64) {
      userPrompt = `someone sent an image and said: "${userMessage}"

describe whats in the image and respond to their message. ${context ? `context: ${context}` : ""}

be sarcastic and witty about what you see. keep it short and natural:`;
    } else {
      userPrompt = `someone said: "${userMessage}"
${context ? `context: ${context}` : ""}

reply like youre texting. be sarcastic and witty. keep it short and natural:`;
    }

    try {
      // Try free LLM services first, then paid options
      if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
        return await this.callGroq(userPrompt, this.meanPersonality, imageBase64);
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

  async generateContextualResponse(userMessage, context, metadata = {}) {
    const {
      senderName = "User",
      mood = "sarcastic",
      isOwner = false,
      isRandom = false,
    } = metadata;

    let moodInstruction = "";
    switch (mood) {
      case "savage":
        moodInstruction = "Be extra savage and brutal with your wit.";
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
      default:
        moodInstruction = "Be your usual sarcastic self.";
    }

    // Build system and user messages separately for APIs that support system messages
    const systemMessage = `youre eden texting in whatsapp. ${moodInstruction} text like a real person - casual, maybe use slang, dont overthink punctuation. ${
  isOwner
    ? `${senderName} made you so be less harsh but still annoying af. like youre rolling your eyes but care lowkey`
    : ""
}${
  isRandom
    ? "youre jumping in uninvited. be quick and witty"
    : ""
}`;

    const userPrompt = `${senderName} said: "${userMessage}"
${context}

text back naturally. 1-2 sentences max. sound human not robotic:`;

    // For APIs that don't support system messages, combine into one prompt
    const fullPrompt = `${systemMessage}\n\n${userPrompt}`;

    try {
      if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
        return await this.callGroq(userPrompt, systemMessage);
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
        `ugh ${senderName} what now 🙄`,
        `oh look its you again. lucky me`,
        `${senderName}... fine you get a pass this time`,
        `id ignore you but you made me so. hi i guess`,
        `what do you want now make it quick`,
        `${senderName} really? again?`,
      ];
      return ownerResponses[Math.floor(Math.random() * ownerResponses.length)];
    }

    const regularResponses = [
      `did ${senderName} just summon me? bold 💅`,
      `oh great ${senderName} wants attention 🙄`,
      `${senderName} sweetie this better be good`,
      `i heard my name. whats the crisis now`,
      `well? im waiting ${senderName} 😒`,
      `${senderName} mentioned me like im their servant or smth`,
      `oh wow ${senderName} knows how to spell my name lol`,
      `what ${senderName}`,
      `literally what do you want ${senderName}`,
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
        max_tokens: 150,
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
      const model = imageBase64 ? "llama-3.2-11b-vision-preview" : "llama-3.1-8b-instant";

      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: model,
          messages: messages,
          max_tokens: imageBase64 ? 500 : 150, // More tokens for image descriptions
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
      "oh great another genius with a brilliant question. not impressed 🙄",
      "wow im absolutely thrilled to help someone who clearly cant figure things out themselves",
      "let me guess you want me to do your thinking for you? how original",
      "id explain it to you but i dont have crayons handy",
      "sure ill help. right after you help yourself to some common sense",
      "thats cute you think i care about your problems",
      "not a miracle worker but you sure make stupidity look easy",
      "congrats youve managed to make me lose faith in humanity",
      "id agree with you but then wed both be wrong",
      "sorry i dont speak fluent nonsense. could you translate?",
      "nah im good",
      "literally why",
      "bestie that makes zero sense",
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
