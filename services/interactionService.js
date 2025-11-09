const axios = require("axios");

class InteractionService {
  constructor() {
    // Tenor API key (you can get a free one from https://tenor.com/developer/keyregistration)
    this.tenorApiKey = process.env.TENOR_API_KEY || "AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ"; // Default demo key
    this.tenorSearchUrl = "https://tenor.googleapis.com/v2/search";
  }

  // Interaction types with their search terms
  getInteractionConfig() {
    return {
      hug: {
        searches: ["anime hug", "hug gif", "cute hug"],
        templates: [
          "{sender} hugs {target}",
          "{sender} gives {target} a big hug",
          "{sender} hugged {target}",
          "*hugs {target}*",
          "{sender} wraps {target} in a warm hug",
        ],
      },
      kiss: {
        searches: ["anime kiss", "kiss gif", "cute kiss"],
        templates: [
          "{sender} kisses {target}",
          "{sender} gives {target} a kiss",
          "{sender} kissed {target}",
          "*kisses {target}*",
          "{sender} plants a kiss on {target}",
        ],
      },
      fuck: {
        searches: ["middle finger", "fuck you gif", "anime angry"],
        templates: [
          "{sender} flips off {target}",
          "{sender} says fuck you to {target}",
          "{sender} gives {target} the finger",
          "*fuck you {target}*",
          "{sender} tells {target} to fuck off",
        ],
      },
      pat: {
        searches: ["anime head pat", "pat pat", "head pat gif"],
        templates: [
          "{sender} pats {target}",
          "{sender} pats {target} on the head",
          "{sender} gives {target} head pats",
          "*pat pat {target}*",
          "{sender} gently pats {target}",
        ],
      },
      love: {
        searches: ["anime love", "heart gif", "love you"],
        templates: [
          "{sender} loves {target}",
          "{sender} shows love to {target}",
          "{sender} ❤️ {target}",
          "*{sender} loves {target}*",
          "{sender} sends love to {target}",
        ],
      },
      slap: {
        searches: ["anime slap", "slap gif"],
        templates: [
          "{sender} slaps {target}",
          "{sender} slapped {target}",
          "*slaps {target}*",
          "{sender} gives {target} a slap",
        ],
      },
      punch: {
        searches: ["anime punch", "punch gif"],
        templates: [
          "{sender} punches {target}",
          "{sender} punched {target}",
          "*punches {target}*",
          "{sender} throws a punch at {target}",
        ],
      },
      bite: {
        searches: ["anime bite", "bite gif", "nom nom"],
        templates: [
          "{sender} bites {target}",
          "{sender} bit {target}",
          "*bites {target}*",
          "{sender} chomps on {target}",
        ],
      },
      poke: {
        searches: ["anime poke", "poke gif"],
        templates: [
          "{sender} pokes {target}",
          "{sender} poked {target}",
          "*pokes {target}*",
          "{sender} gives {target} a poke",
        ],
      },
      cuddle: {
        searches: ["anime cuddle", "cuddle gif", "cute cuddle"],
        templates: [
          "{sender} cuddles {target}",
          "{sender} cuddled with {target}",
          "*cuddles {target}*",
          "{sender} snuggles up to {target}",
        ],
      },
    };
  }

  // Get random template for interaction
  getRandomTemplate(interaction, sender, target) {
    const config = this.getInteractionConfig();
    const interactionConfig = config[interaction];
    
    if (!interactionConfig) {
      return `${sender} ${interaction}s ${target}`;
    }

    const templates = interactionConfig.templates;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    return template
      .replace("{sender}", sender)
      .replace("{target}", target);
  }

  // Search for GIF using Tenor API
  async searchGif(interaction) {
    try {
      const config = this.getInteractionConfig();
      const interactionConfig = config[interaction];
      
      if (!interactionConfig) {
        return null;
      }

      // Pick a random search term
      const searchTerms = interactionConfig.searches;
      const searchTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];

      const response = await axios.get(this.tenorSearchUrl, {
        params: {
          q: searchTerm,
          key: this.tenorApiKey,
          limit: 20,
          media_filter: "gif",
          contentfilter: "medium",
        },
      });

      if (response.data && response.data.results && response.data.results.length > 0) {
        // Pick a random GIF from results
        const randomIndex = Math.floor(Math.random() * response.data.results.length);
        const gif = response.data.results[randomIndex];
        
        // Get the MP4 URL (WhatsApp plays MP4 as GIF better than actual GIF)
        const mp4Url = gif.media_formats?.mp4?.url || 
                       gif.media_formats?.tinygif?.url ||
                       gif.media_formats?.gif?.url || 
                       gif.url;
        
        console.log(`🎬 Selected format:`, {
          hasMp4: !!gif.media_formats?.mp4,
          hasTinyGif: !!gif.media_formats?.tinygif,
          hasGif: !!gif.media_formats?.gif,
          using: mp4Url,
        });
        
        return {
          url: mp4Url,
          title: gif.content_description || searchTerm,
        };
      }

      return null;
    } catch (error) {
      console.error("Error searching for GIF:", error.message);
      return null;
    }
  }

  // Get available interaction commands
  getAvailableCommands() {
    return Object.keys(this.getInteractionConfig());
  }

  // Check if command is an interaction
  isInteractionCommand(command) {
    return this.getAvailableCommands().includes(command);
  }
}

module.exports = InteractionService;
