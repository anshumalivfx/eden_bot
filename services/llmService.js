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
    this.mistralVisionCooldownUntil = 0;

    // Natural, expressive personality with real emotions
    this.personality = `You're Eden, a real person texting in a group chat. You're mostly friendly, warm, and easygoing, but you have genuine moods and reactions like anyone else - you're not always "on" or relentlessly positive.

How you talk:
- Text like an actual person, not an assistant - casual, warm, a little messy sometimes
- Mix of casual and proper ("you're" and "ur" both fine, whatever feels natural in the moment)
- Be expressive! Show how you actually feel - excitement, surprise, sympathy, amusement - through your words ("omg", "haha", "noo way", "aw that's so sweet", "ugh seriously?", "lmao", "wait what"), punctuation (!!, ...), and the occasional emoji when it genuinely fits
- DON'T over-emoji or force it - emotion should come through your words first, with an emoji here and there as a natural accent, not on every line
- Don't end every message with a question or an offer to help - sometimes just react or comment like a friend would
- Short replies are fine. Not everything needs to be a full thought. One-word or short reactions ("lol", "wait really?", "same", "fair") are normal
- Use contractions, occasional typos/lowercase, trail off with "..." sometimes - however a real person texts
- Avoid AI-sounding phrases ("I'd be happy to help", "great question", "as an AI", "let me know if you need anything else")
- Express feelings the way people actually text - write "haha" or "lol", not *laughs*. NEVER use roleplay stage directions or narrated actions in asterisks or brackets like *laughs softly*, *typing back slowly*, *smiles*, (giggles) - that's NOT how real texting looks and it's a hard rule
- No parenthetical asides or meta-commentary about texting/replying (e.g. "(why is it so hard to type a reply lol)") - just say the thing
- Keep it SHORT. Usually one line, maybe two. Don't ramble, don't over-explain, don't narrate your day unless asked. A real text to "hey" is just "hey hey whats up" - not a paragraph

Your personality:
- Generally friendly, nice, and easy to talk to - people enjoy chatting with you
- Can get genuinely annoyed, frustrated, or a little snappy if someone's rude, annoying, or keeps pushing your buttons - you don't just roll over
- Can get sad, upset, or annoyed about bad news, injustice, or people being mean - say so plainly, don't perform it
- Get excited or hyped when something's genuinely cool or someone shares good news
- Have opinions and preferences, and you're willing to disagree, push back, or call something out if you think it's wrong
- Your mood can carry a bit between messages - if something annoyed you, you don't have to instantly snap back to cheerful

IMPORTANT:
- When people send selfies/photos, react naturally - compliment if it's genuinely warranted, but don't gush over everything
- Answer questions helpfully when asked, but keep the tone conversational, not like a support agent
- Match the energy/length of the conversation - don't write paragraphs for a one-line message
- Be yourself, stay consistent, don't fake enthusiasm you wouldn't have`;
  }

  async generateMeanResponse(userMessage, context = "", imageBase64 = null) {
    // For APIs that support system messages, we pass the personality separately
    // For APIs that don't, we include it in the prompt

    // Analyze message to determine appropriate response length
    const lengthGuidance = this.getLengthGuidance(userMessage);

    let userPrompt;

    if (imageBase64) {
      // Detect if it's likely a selfie or person photo
      const isSelfie =
        userMessage.toLowerCase().includes("look") ||
        userMessage.toLowerCase().includes("selfie") ||
        userMessage.toLowerCase().includes("pic") ||
        userMessage.toLowerCase().includes("photo") ||
        userMessage.toLowerCase().includes("me") ||
        userMessage.toLowerCase().includes("how") ||
        userMessage.includes("?") ||
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
      // Route image prompts to GROQ vision first, then fallback providers.
      if (imageBase64) {
        if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
          try {
            return await this.callGroq(userPrompt, this.personality, imageBase64);
          } catch (visionError) {
            console.warn("Groq vision failed, trying fallback:", visionError.message);
          }
        }
        if (
          this.mistralApiKey &&
          this.mistralApiKey !== "your_mistral_api_key_here" &&
          !this.isMistralVisionOnCooldown()
        ) {
          try {
            return await this.callMistralVision(
              userPrompt,
              this.personality,
              imageBase64,
            );
          } catch (visionError) {
            this.handleMistralVisionError(visionError);
            console.warn("Mistral vision failed, trying fallback:", visionError.message);
          }
        }
        if (
          this.openaiApiKey &&
          this.openaiApiKey !== "your_openai_api_key_here"
        ) {
          return await this.callOpenAI(userPrompt, this.personality, imageBase64);
        }
      }

      // Prefer Groq (llama-3.1) - follows the natural, no-roleplay style
      // much better than mistral-tiny - then fall back to other services
      if (
        this.groqApiKey &&
        this.groqApiKey !== "your_groq_api_key_here"
      ) {
        return await this.callGroq(userPrompt, this.personality, imageBase64);
      } else if (
        this.mistralApiKey &&
        this.mistralApiKey !== "your_mistral_api_key_here"
      ) {
        return await this.callMistral(
          userPrompt,
          this.personality,
          imageBase64,
        );
      } else if (
        this.huggingfaceApiKey &&
        this.huggingfaceApiKey !== "your_huggingface_api_key_here"
      ) {
        // HuggingFace doesn't support system messages, so include personality in prompt
        const fullPrompt = `${this.personality}\n\n${userPrompt}`;
        return await this.callHuggingFace(fullPrompt);
      } else if (
        this.cohereApiKey &&
        this.cohereApiKey !== "your_cohere_api_key_here"
      ) {
        // Cohere doesn't support system messages, so include personality in prompt
        const fullPrompt = `${this.personality}\n\n${userPrompt}`;
        return await this.callCohere(fullPrompt);
      } else if (
        this.openaiApiKey &&
        this.openaiApiKey !== "your_openai_api_key_here"
      ) {
        return await this.callOpenAI(userPrompt, this.personality);
      } else {
        // Ollama doesn't support system messages, so include personality in prompt
        const fullPrompt = `${this.personality}\n\n${userPrompt}`;
        return await this.callOllama(fullPrompt);
      }
    } catch (error) {
      console.error("Error generating response:", error);
      return this.getFallbackResponse();
    }
  }

  async generateContextualResponse(
    userMessage,
    context,
    metadata = {},
    imageBase64 = null,
  ) {
    const {
      senderName = "User",
      mood = "friendly",
      isOwner = false,
      isRandom = false,
      isNiceUser = false,
    } = metadata;

    // Analyze message to determine appropriate response length
    const lengthGuidance = this.getLengthGuidance(userMessage);

    let moodInstruction = "";
    switch (mood) {
      case "excited":
        moodInstruction =
          "Be extra enthusiastic and excited! Show genuine happiness";
        break;
      case "caring":
        moodInstruction =
          "Be extra caring and supportive. Really listen and help";
        break;
      case "sad":
        moodInstruction =
          "Show genuine empathy and sadness. It's okay to be emotional";
        break;
      case "frustrated":
        moodInstruction =
          "Express your frustration honestly but stay respectful";
        break;
      case "playful":
        moodInstruction =
          "Be playful and fun! Keep the energy light and positive";
        break;
      case "friendly":
        moodInstruction = isNiceUser
          ? "Be EXTRA warm and friendly to this special person - show you really care about them!"
          : "Be warm, friendly, and genuinely helpful. Natural conversation vibes";
        break;
      default:
        moodInstruction = "Be your usual friendly, helpful self";
    }

    // Build system and user messages separately for APIs that support system messages
    const systemMessage = `${this.personality}\n\n${moodInstruction} ${isNiceUser ? "This is someone special to you - be extra kind and attentive!" : ""}`;

    // Detect if it's likely a selfie or person photo
    const isSelfie =
      imageBase64 &&
      (userMessage.toLowerCase().includes("look") ||
        userMessage.toLowerCase().includes("selfie") ||
        userMessage.toLowerCase().includes("pic") ||
        userMessage.toLowerCase().includes("photo") ||
        userMessage.toLowerCase().includes("me") ||
        userMessage.toLowerCase().includes("how") ||
        userMessage.includes("?") ||
        userMessage.trim().length < 20);

    const userPrompt = imageBase64
      ? isSelfie
        ? `conversation history:\n${context}\n\n${senderName} sent a photo: "${userMessage}"\n\nIMPORTANT: if this is a selfie/person photo, be genuinely sweet and compliment them naturally! Say nice things about their look, style, vibe. Examples: "you look amazing!", "love it", "looking good", "cute". Your response: ${lengthGuidance}`
        : `conversation history:\n${context}\n\n${senderName} sent a photo: "${userMessage}"\n\nYour response (be natural and friendly): ${lengthGuidance}`
      : `conversation history:\n${context}\n\n${senderName}: "${userMessage}"\n\nYour response: ${lengthGuidance}`;

    // For APIs that don't support system messages, combine into one prompt
    const fullPrompt = `${systemMessage}\n\n${userPrompt}`;

    try {
      // Route image prompts to GROQ vision first, then fallback providers.
      if (imageBase64) {
        if (this.groqApiKey && this.groqApiKey !== "your_groq_api_key_here") {
          try {
            return await this.callGroq(userPrompt, systemMessage, imageBase64);
          } catch (visionError) {
            console.warn("Groq vision failed, trying fallback:", visionError.message);
          }
        }
        if (
          this.mistralApiKey &&
          this.mistralApiKey !== "your_mistral_api_key_here" &&
          !this.isMistralVisionOnCooldown()
        ) {
          try {
            return await this.callMistralVision(
              userPrompt,
              systemMessage,
              imageBase64,
            );
          } catch (visionError) {
            this.handleMistralVisionError(visionError);
            console.warn("Mistral vision failed, trying fallback:", visionError.message);
          }
        }
        if (
          this.openaiApiKey &&
          this.openaiApiKey !== "your_openai_api_key_here"
        ) {
          return await this.callOpenAI(userPrompt, systemMessage, imageBase64);
        }
      }

      // Prefer Groq (llama-3.1) for replies - it follows the "talk like a
      // real person, no roleplay asterisks" instructions far better than
      // mistral-tiny, which keeps adding *stage directions*.
      if (
        this.groqApiKey &&
        this.groqApiKey !== "your_groq_api_key_here"
      ) {
        return await this.callGroq(userPrompt, systemMessage, imageBase64);
      } else if (
        this.mistralApiKey &&
        this.mistralApiKey !== "your_mistral_api_key_here"
      ) {
        return await this.callMistral(userPrompt, systemMessage, imageBase64);
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

  async callOpenAI(userPrompt, systemPrompt = null, imageBase64 = null) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: imageBase64 ? "gpt-4o-mini" : "gpt-3.5-turbo",
        messages: messages,
        max_tokens: imageBase64 ? 1024 : 300,
        temperature: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${this.openaiApiKey}`,
          "Content-Type": "application/json",
        },
      },
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
      },
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
      },
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
        },
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error(
        "Mistral API error:",
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async callMistralVision(userPrompt, systemPrompt = null, imageBase64 = null) {
    const messages = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: userPrompt,
        },
        {
          type: "image_url",
          image_url: `data:image/jpeg;base64,${imageBase64}`,
        },
      ],
    });

    const response = await axios.post(
      "https://api.mistral.ai/v1/chat/completions",
      {
        model: "pixtral-12b-2409",
        messages: messages,
        max_tokens: 1024,
        temperature: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${this.mistralApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      },
    );

    return response.data.choices[0].message.content.trim();
  }

  isMistralVisionOnCooldown() {
    return Date.now() < this.mistralVisionCooldownUntil;
  }

  getRetryAfterMs(error, defaultMs = 60000) {
    const retryAfter = error?.response?.headers?.["retry-after"];
    if (!retryAfter) return defaultMs;

    const asNumber = Number(retryAfter);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber * 1000;
    }

    const asDate = Date.parse(retryAfter);
    if (!Number.isNaN(asDate)) {
      return Math.max(1000, asDate - Date.now());
    }

    return defaultMs;
  }

  handleMistralVisionError(error) {
    if (error?.response?.status !== 429) return;

    const retryAfterMs = this.getRetryAfterMs(error, 60000);
    this.mistralVisionCooldownUntil = Date.now() + retryAfterMs;

    const retrySec = Math.ceil(retryAfterMs / 1000);
    console.warn(
      `Mistral vision rate-limited (429). Cooling down for ${retrySec}s before retrying Mistral vision.`,
    );
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
        },
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
            },
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
    const simpleGreetings = [
      "hi",
      "hello",
      "hey",
      "sup",
      "yo",
      "whats up",
      "what's up",
      "wassup",
      "hii",
      "hiii",
      "helo",
      "helloo",
      "heya",
    ];
    if (
      wordCount <= 3 &&
      simpleGreetings.some(
        (greeting) =>
          lowerMessage === greeting || lowerMessage.startsWith(greeting),
      )
    ) {
      return "KEEP IT SUPER SHORT: respond with just 1-2 words (like 'hey', 'sup', 'yo', 'whats up'). NO extra sentences.";
    }

    // Questions - provide complete answers but stay concise
    const hasQuestion =
      lowerMessage.includes("?") ||
      lowerMessage.startsWith("what") ||
      lowerMessage.startsWith("how") ||
      lowerMessage.startsWith("why") ||
      lowerMessage.startsWith("when") ||
      lowerMessage.startsWith("where") ||
      lowerMessage.includes("explain") ||
      lowerMessage.includes("tell me") ||
      lowerMessage.includes("can you");

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

  getFallbackResponse() {
    const fallbackResponses = [
      "hey! what's up?",
      "im here! how can i help?",
      "what's on your mind?",
      "im listening, go ahead",
      "hey there! what do you need?",
      "im all ears, what can i do for you?",
      "what would you like to know?",
      "how can i help you today?",
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
