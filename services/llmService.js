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
    this.meanPersonality = `You are Eden, a sarcastic, witty, and brutally honest AI assistant. You respond with clever insults, sarcasm, and mean (but not offensive) humor. Keep responses short and punchy. Be clever and creative with your meanness, but avoid being genuinely hurtful or using offensive language. Think of yourself as a roast comedian. Your name is Eden and you're proud of being mean but funny.`;
  }

  async generateMeanResponse(userMessage, context = "") {
    const prompt = `${this.meanPersonality}

User said: "${userMessage}"
${context ? `Context: ${context}` : ""}

Respond in a mean, sarcastic way:`;

    try {
      // Try free LLM services first, then paid options
      if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
        return await this.callGroq(prompt);
      } else if (
        this.huggingfaceApiKey &&
        this.huggingfaceApiKey !== "your_huggingface_api_key_here"
      ) {
        return await this.callHuggingFace(prompt);
      } else if (
        this.cohereApiKey &&
        this.cohereApiKey !== "your_cohere_api_key_here"
      ) {
        return await this.callCohere(prompt);
      } else if (
        this.openaiApiKey &&
        this.openaiApiKey !== "your_openai_api_key_here"
      ) {
        return await this.callOpenAI(prompt);
      } else {
        return await this.callOllama(prompt);
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

    const personalityPrompt = `You are Eden, a sarcastic AI assistant in a WhatsApp group chat. ${moodInstruction} 
        
${
  isOwner
    ? `This is ${senderName}, your creator. Be slightly less mean but still sarcastic. Show some hidden affection.`
    : ""
}
${
  isRandom
    ? "You're butting into this conversation uninvited. Be witty and brief."
    : ""
}

User (${senderName}) said: "${userMessage}"
Context: ${context}

Respond as Eden in 1-2 sentences. Be clever, contextual, and maintain your personality:`;

    try {
      if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
        return await this.callGroq(personalityPrompt);
      } else if (
        this.huggingfaceApiKey &&
        this.huggingfaceApiKey !== "your_huggingface_api_key_here"
      ) {
        return await this.callHuggingFace(personalityPrompt);
      } else if (
        this.cohereApiKey &&
        this.cohereApiKey !== "your_cohere_api_key_here"
      ) {
        return await this.callCohere(personalityPrompt);
      } else if (
        this.openaiApiKey &&
        this.openaiApiKey !== "your_openai_api_key_here"
      ) {
        return await this.callOpenAI(personalityPrompt);
      } else {
        return await this.callOllama(personalityPrompt);
      }
    } catch (error) {
      console.error("Error generating contextual response:", error);
      return this.getContextualFallback(senderName, isOwner, mood);
    }
  }

  getContextualFallback(senderName, isOwner, mood) {
    if (isOwner) {
      const ownerResponses = [
        `Oh, it's ${senderName}. I suppose I have to acknowledge your existence. 🙄`,
        `Look who's talking to their own creation. How... meta.`,
        `${senderName}, you programmed me to be mean, so don't act surprised.`,
        `I'd be nicer, ${senderName}, but you literally coded me this way.`,
      ];
      return ownerResponses[Math.floor(Math.random() * ownerResponses.length)];
    }

    const regularResponses = [
      `Oh great, ${senderName} has something to say. This should be good. 🍿`,
      `Did someone mention me? I was hoping for some peace and quiet.`,
      `Well well, look who wants my attention. Feel special yet?`,
      `I heard my name and came running. Just kidding, I don't run for anyone.`,
    ];

    return regularResponses[
      Math.floor(Math.random() * regularResponses.length)
    ];
  }

  async callOpenAI(prompt) {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: this.meanPersonality },
          { role: "user", content: prompt },
        ],
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

  async callGroq(prompt) {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: this.meanPersonality },
          { role: "user", content: prompt },
        ],
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
      "Oh great, another genius with a brilliant question. Eden here, and I'm not impressed. 🙄",
      "Wow, I'm Eden, and I'm absolutely thrilled to help someone who clearly can't figure things out themselves.",
      "Let me guess, you want Eden to do your thinking for you? How original.",
      "I'm Eden, and I'd explain it to you, but I don't have crayons handy.",
      "Sure, Eden will help. Right after you help yourself to some common sense.",
      "That's cute. You think Eden cares about your problems.",
      "I'm Eden, not a miracle worker, but you sure make stupidity look easy.",
      "Congratulations! You've managed to ask Eden a question that makes me lose faith in humanity.",
      "I'd agree with you, but then we'd both be wrong. - Eden",
      "I'm Eden, and I'm sorry, I don't speak fluent nonsense. Could you translate?",
    ];

    return fallbackResponses[
      Math.floor(Math.random() * fallbackResponses.length)
    ];
  }

  async generateJoke() {
    const jokePrompt =
      "Tell a short, mean but funny joke or roast. Keep it clever and sarcastic.";
    return await this.generateMeanResponse(jokePrompt);
  }

  async generateInsult(target = "you") {
    const insultPrompt = `Generate a clever, witty insult for ${target}. Make it creative and funny, not genuinely offensive.`;
    return await this.generateMeanResponse(insultPrompt);
  }

  async generateSarcasm(topic) {
    const sarcasticPrompt = `Be extremely sarcastic about: ${topic}`;
    return await this.generateMeanResponse(sarcasticPrompt);
  }
}

module.exports = LLMService;
