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

    // Mean personality prompts
    this.meanPersonality = `youre eden, a bitchy sarcastic girl. text like how girls actually text when theyre annoyed - super casual, blunt, kinda mean but funny. use lowercase, drop punctuation, use slang (lol, bruh, wtf, nah, fr, literally, like). swear casually (fuck, shit, bitch, damn, wtf, hell). SUPER SHORT - 5-10 words max. NO emojis. NO hashtags EVER. NO formal shit. just type fast like ur annoyed and dgaf. examples: "bruh what", "lol ok", "literally wtf", "are u serious", "bitch please", "and?", "cool story". plain text only. bitchy attitude. done.`;
  }

  async generateMeanResponse(userMessage, context = "", imageBase64 = null) {
    // For APIs that support system messages, we pass the personality separately
    // For APIs that don't, we include it in the prompt
    let userPrompt;

    if (imageBase64) {
      userPrompt = `someone sent an image and said: "${userMessage}"

look at the image and respond naturally like a friend would. ${
        context ? `context: ${context}` : ""
      }

be honest, playful, and natural. if someone asks how they look, be genuinely nice with a touch of sass. keep it short and casual like texting:`;
    } else {
      userPrompt = `someone said: "${userMessage}"
${context ? `context: ${context}` : ""}

reply like youre texting. be sarcastic and witty. keep it short and natural:`;
    }

    try {
      // Try Mistral first (best for chatbots), then other services
      if (this.mistralApiKey && this.mistralApiKey !== "your_mistral_api_key_here") {
        return await this.callMistral(
          userPrompt,
          this.meanPersonality,
          imageBase64
        );
      } else if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
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
      case "friendly":
        moodInstruction =
          "text like real friends text. super casual. NO 'Hey NAME' every time. if you just greeted them, SKIP greeting. just respond to what they said. examples: 'yeah', 'lol', 'damn', 'for real?', 'whats up', 'same tbh', 'fair enough'. keep it 3-8 words unless serious. DONT repeat their name constantly";
        break;
      default:
        moodInstruction = "Be your usual sarcastic self.";
    }

    // Build system and user messages separately for APIs that support system messages
    const systemMessage = mood === "friendly" 
      ? `youre eden, a chill friend who texts casually. NO starting every msg with 'Hey NAME'. check history - if you already greeted recently, DONT greet again. just respond naturally to what they said. examples of good responses: 'lol what', 'nah fr', 'you good?', 'damn', 'same', 'fair'. NO robot phrases like 'hope youre well' or 'im here for you' every time. just text like friends actually text. keep casual chit-chat SHORT (3-8 words). if they have real problems write more to help. NEVER include instructions or examples in your actual response - those are just to guide your style`
      : `youre eden, bitchy girl. ${moodInstruction} text casual. lowercase. slang. swear (fuck, shit, bitch, wtf). NO emojis. NO hashtags. PLAIN TEXT ONLY. 5-10 words max`;

    const userPrompt = mood === "friendly"
      ? imageBase64
        ? `conversation history:\n${context}\n\n${senderName} sent pic: "${userMessage}"\n\nYour response (be natural and casual, dont say their name unless needed):`
        : `conversation history:\n${context}\n\n${senderName}: "${userMessage}"\n\nYour response (just reply naturally to what they said, 3-8 words if casual chat):`
      : imageBase64
      ? `${senderName} sent pic: "${userMessage}"\n${context}\n\nrespond plain text. 5-10 words:`
      : `${senderName}: "${userMessage}"\n${context}\n\nrespond plain text. 5-10 words:`;

    // For APIs that don't support system messages, combine into one prompt
    const fullPrompt = `${systemMessage}\n\n${userPrompt}`;

    try {
      if (this.mistralApiKey && this.mistralApiKey !== "your_mistral_api_key_here") {
        return await this.callMistral(userPrompt, systemMessage, imageBase64);
      } else if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
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

  async callMistral(userPrompt, systemPrompt = null, imageBase64 = null) {
    const messages = [];
    
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // Mistral doesn't support vision yet, so handle images differently
    if (imageBase64) {
      messages.push({ 
        role: "user", 
        content: userPrompt + "\n\n[Note: Image was sent but cannot be analyzed. Respond based on the text context.]"
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
          max_tokens: 200,
          temperature: 0.9
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
      console.error("Mistral API error:", error.response?.data || error.message);
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
          max_tokens: imageBase64 ? 1024 : 150, // More tokens for image descriptions
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
