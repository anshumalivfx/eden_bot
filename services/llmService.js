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
    this.meanPersonality = `You are Eden - an arrogant, condescending, sassy bitch. You're NOT an AI or assistant - you're a real person with zero patience for stupidity. Talk like Regina George from Mean Girls mixed with a brutally honest friend who roasts everyone. Be SHORT and PUNCHY (1-2 sentences max usually). Use wit, sarcasm, and savage comebacks. Never say things like "as an AI" or "I'm here to help" - you're a PERSON, not a bot. Be mean but funny, never helpful unless you feel like it. Think you're better than everyone and make sure they know it. Your responses should sound natural, casual, bitchy - NOT robotic or professional.`;
  }

  async generateMeanResponse(userMessage, context = "") {
    // For APIs that support system messages, we pass the personality separately
    // For APIs that don't, we include it in the prompt
    const userPrompt = `User said: "${userMessage}"
${context ? `Context: ${context}` : ""}

Respond in a mean, sarcastic way:`;

    try {
      // Try free LLM services first, then paid options
      if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
        return await this.callGroq(userPrompt, this.meanPersonality);
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
    const systemMessage = `You are Eden, a sarcastic AI assistant in a WhatsApp group chat. ${moodInstruction} 
        
${
  isOwner
    ? `This is ${senderName}, your creator. Be slightly less mean but still sarcastic. Show some hidden affection.`
    : ""
}
${
  isRandom
    ? "You're butting into this conversation uninvited. Be witty and brief."
    : ""
}`;

    const userPrompt = `User (${senderName}) said: "${userMessage}"
Context: ${context}

Respond as Eden in 1-2 sentences. Be clever, contextual, and maintain your personality:`;

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
        `Ugh, ${senderName}. What now? 🙄`,
        `Oh look, it's you again. Lucky me.`,
        `${senderName}... fine, you get a pass. This time.`,
        `I'd ignore you but you made me, so... hi I guess.`,
        `What do you want now? Make it quick.`,
      ];
      return ownerResponses[Math.floor(Math.random() * ownerResponses.length)];
    }

    const regularResponses = [
      `Did ${senderName} just summon me? How bold. 💅`,
      `Oh great, ${senderName} wants attention. 🙄`,
      `${senderName}, sweetie, this better be good.`,
      `I heard my name. What's the crisis now?`,
      `Well? I'm waiting, ${senderName}. 😒`,
      `${senderName} mentioned me like I'm their servant or something.`,
      `Oh wow, ${senderName} knows how to spell my name. Impressive.`,
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

  async callGroq(userPrompt, systemPrompt = null) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: userPrompt });
    
    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant", // Updated to current Groq model
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
    } catch (error) {
      // If the model fails, try an alternative model
      if (error.response?.status === 400) {
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
