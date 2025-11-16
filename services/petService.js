const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class PetService {
  constructor() {
    this.dbPath = path.join(__dirname, "..", "pets.db");
    this.db = new sqlite3.Database(this.dbPath);
    this.initDatabase();

    // Pet species with unique traits
    this.species = {
      dragon: {
        name: "Dragon",
        emoji: "🐉",
        traits: [
          "Fire Breath",
          "Sky Soarer",
          "Treasure Hoarder",
          "Ancient Wisdom",
          "Fierce Guardian",
        ],
      },
      phoenix: {
        name: "Phoenix",
        emoji: "🔥",
        traits: [
          "Eternal Rebirth",
          "Flame Walker",
          "Sun Blessed",
          "Ash Dance",
          "Phoenix Tears",
        ],
      },
      unicorn: {
        name: "Unicorn",
        emoji: "🦄",
        traits: [
          "Magic Horn",
          "Rainbow Mane",
          "Pure Heart",
          "Starlight Gallop",
          "Dream Weaver",
        ],
      },
      griffin: {
        name: "Griffin",
        emoji: "🦅",
        traits: [
          "Lion's Courage",
          "Eagle Eyes",
          "Sky Predator",
          "Noble Heart",
          "Mountain King",
        ],
      },
      hydra: {
        name: "Hydra",
        emoji: "🐍",
        traits: [
          "Multi-Head",
          "Regenerator",
          "Venom Strike",
          "Water Serpent",
          "Endless Hunger",
        ],
      },
      glimmer: {
        name: "Glimmer",
        emoji: "✨",
        traits: [
          "Sparkle Dust",
          "Light Weaver",
          "Crystal Wings",
          "Shimmer Aura",
          "Rainbow Trail",
        ],
      },
    };

    // Moods based on stats
    this.moods = [
      "Playful",
      "Happy",
      "Excited",
      "Content",
      "Sleepy",
      "Hungry",
      "Energetic",
      "Lazy",
      "Curious",
      "Affectionate",
      "Mischievous",
      "Calm",
      "Restless",
      "Proud",
      "Grumpy",
    ];

    // Gifts that can be claimed
    this.gifts = [
      "✨ Stardust",
      "💎 Crystal Shard",
      "🌟 Moonstone",
      "🔮 Magic Orb",
      "🎁 Mystery Box",
      "🏆 Trophy",
      "👑 Crown",
      "⚡ Lightning Bolt",
      "🌈 Rainbow Scale",
    ];
  }

  initDatabase() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS pets (
          userId TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          species TEXT NOT NULL,
          level INTEGER DEFAULT 1,
          bond INTEGER DEFAULT 1,
          happiness INTEGER DEFAULT 80,
          energy INTEGER DEFAULT 100,
          hunger INTEGER DEFAULT 80,
          experience INTEGER DEFAULT 0,
          traits TEXT DEFAULT '',
          giftReady INTEGER DEFAULT 0,
          lastFed INTEGER DEFAULT 0,
          lastPlayed INTEGER DEFAULT 0,
          lastTrained INTEGER DEFAULT 0,
          createdAt INTEGER DEFAULT 0
        )
      `);
    });
  }

  async getPet(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM pets WHERE userId = ?",
        [userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async createPet(userId, name, species) {
    const now = Date.now();
    const speciesData = this.species[species] || this.species.dragon;

    // Select 3 random traits
    const selectedTraits = this.getRandomTraits(speciesData.traits, 3);

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO pets (userId, name, species, traits, createdAt, lastFed, lastPlayed, lastTrained)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, species, selectedTraits.join(","), now, now, now, now],
        function (err) {
          if (err) reject(err);
          else resolve({ userId, name, species, traits: selectedTraits });
        }
      );
    });
  }

  async updatePet(userId, updates) {
    const fields = Object.keys(updates)
      .map((key) => `${key} = ?`)
      .join(", ");
    const values = [...Object.values(updates), userId];

    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE pets SET ${fields} WHERE userId = ?`,
        values,
        function (err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  getRandomTraits(traitPool, count) {
    const shuffled = [...traitPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  async feedPet(userId) {
    const pet = await this.getPet(userId);
    if (!pet)
      return {
        error: "You don't have a pet yet! Use -pet create <name> <species>",
      };

    const now = Date.now();
    const timeSinceLastFed = now - pet.lastFed;
    const cooldown = 2 * 60 * 60 * 1000; // 2 hours

    if (timeSinceLastFed < cooldown) {
      const timeLeft = Math.ceil((cooldown - timeSinceLastFed) / (60 * 1000));
      return {
        error: `Your pet is still full! Feed again in ${timeLeft} minutes.`,
      };
    }

    // Update stats
    const newHunger = Math.min(100, pet.hunger + 30);
    const newHappiness = Math.min(100, pet.happiness + 10);
    const newExp = pet.experience + 15;
    const newLevel = Math.floor(newExp / 100) + 1;

    await this.updatePet(userId, {
      hunger: newHunger,
      happiness: newHappiness,
      experience: newExp,
      level: newLevel,
      lastFed: now,
    });

    return {
      success: true,
      message: `🍖 Fed ${pet.name}! +30 Hunger, +10 Happiness, +15 EXP`,
      levelUp: newLevel > pet.level,
    };
  }

  async playWithPet(userId) {
    const pet = await this.getPet(userId);
    if (!pet)
      return {
        error: "You don't have a pet yet! Use -pet create <name> <species>",
      };

    const now = Date.now();
    const timeSinceLastPlayed = now - pet.lastPlayed;
    const cooldown = 1 * 60 * 60 * 1000; // 1 hour

    if (timeSinceLastPlayed < cooldown) {
      const timeLeft = Math.ceil(
        (cooldown - timeSinceLastPlayed) / (60 * 1000)
      );
      return { error: `Your pet is tired! Play again in ${timeLeft} minutes.` };
    }

    // Update stats
    const newHappiness = Math.min(100, pet.happiness + 20);
    const newEnergy = Math.max(0, pet.energy - 15);
    const newBond = Math.min(100, pet.bond + 5);
    const newExp = pet.experience + 20;
    const newLevel = Math.floor(newExp / 100) + 1;

    await this.updatePet(userId, {
      happiness: newHappiness,
      energy: newEnergy,
      bond: newBond,
      experience: newExp,
      level: newLevel,
      lastPlayed: now,
    });

    return {
      success: true,
      message: `🎾 Played with ${pet.name}! +20 Happiness, +5 Bond, +20 EXP`,
      levelUp: newLevel > pet.level,
    };
  }

  async trainPet(userId) {
    const pet = await this.getPet(userId);
    if (!pet)
      return {
        error: "You don't have a pet yet! Use -pet create <name> <species>",
      };

    const now = Date.now();
    const timeSinceLastTrained = now - pet.lastTrained;
    const cooldown = 3 * 60 * 60 * 1000; // 3 hours

    if (timeSinceLastTrained < cooldown) {
      const timeLeft = Math.ceil(
        (cooldown - timeSinceLastTrained) / (60 * 1000)
      );
      return {
        error: `Your pet needs rest! Train again in ${timeLeft} minutes.`,
      };
    }

    // Update stats
    const newEnergy = Math.max(0, pet.energy - 25);
    const newBond = Math.min(100, pet.bond + 8);
    const newExp = pet.experience + 35;
    const newLevel = Math.floor(newExp / 100) + 1;

    // Check if gift should be ready
    const newGiftReady =
      newLevel % 5 === 0 && newLevel !== pet.level ? 1 : pet.giftReady;

    await this.updatePet(userId, {
      energy: newEnergy,
      bond: newBond,
      experience: newExp,
      level: newLevel,
      giftReady: newGiftReady,
      lastTrained: now,
    });

    return {
      success: true,
      message: `💪 Trained ${pet.name}! +8 Bond, +35 EXP`,
      levelUp: newLevel > pet.level,
      giftReady: newGiftReady === 1,
    };
  }

  async claimGift(userId) {
    const pet = await this.getPet(userId);
    if (!pet) return { error: "You don't have a pet yet!" };

    if (!pet.giftReady) {
      return {
        error:
          "No gift available! Train your pet to unlock gifts at levels 5, 10, 15, etc.",
      };
    }

    const gift = this.gifts[Math.floor(Math.random() * this.gifts.length)];

    await this.updatePet(userId, { giftReady: 0 });

    return {
      success: true,
      gift: gift,
      message: `🎁 ${pet.name} gave you a gift: ${gift}!`,
    };
  }

  async renamePet(userId, newName) {
    const pet = await this.getPet(userId);
    if (!pet) return { error: "You don't have a pet yet!" };

    if (newName.length > 20) {
      return { error: "Name is too long! Max 20 characters." };
    }

    await this.updatePet(userId, { name: newName });

    return {
      success: true,
      message: `✏️ Your pet is now named ${newName}!`,
    };
  }

  async addTrait(userId) {
    const pet = await this.getPet(userId);
    if (!pet) return { error: "You don't have a pet yet!" };

    const speciesData = this.species[pet.species] || this.species.dragon;
    const currentTraits = pet.traits.split(",").filter((t) => t);

    if (currentTraits.length >= 5) {
      return { error: "Your pet already has maximum traits (5)!" };
    }

    // Get available traits
    const availableTraits = speciesData.traits.filter(
      (t) => !currentTraits.includes(t)
    );

    if (availableTraits.length === 0) {
      return { error: "Your pet has all available traits!" };
    }

    const newTrait =
      availableTraits[Math.floor(Math.random() * availableTraits.length)];
    const updatedTraits = [...currentTraits, newTrait].join(",");

    await this.updatePet(userId, { traits: updatedTraits });

    return {
      success: true,
      trait: newTrait,
      message: `✨ ${pet.name} learned a new trait: ${newTrait}!`,
    };
  }

  getMood(pet) {
    // Mood based on happiness and energy
    if (pet.happiness > 80 && pet.energy > 70) return "Playful";
    if (pet.happiness > 90) return "Happy";
    if (pet.energy < 30) return "Sleepy";
    if (pet.hunger < 40) return "Hungry";
    if (pet.happiness < 40) return "Grumpy";
    if (pet.bond > 80) return "Affectionate";

    return this.moods[Math.floor(Math.random() * this.moods.length)];
  }

  createProgressBar(value, maxValue = 100) {
    const percentage = Math.round((value / maxValue) * 100);
    const filled = Math.floor((value / maxValue) * 14);
    const empty = 14 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    return `${percentage}%  |${bar}|`;
  }

  async formatPetDisplay(userId) {
    const pet = await this.getPet(userId);
    if (!pet) {
      return null;
    }

    // Decay stats over time
    await this.decayStats(pet);

    // Refresh pet data after decay
    const updatedPet = await this.getPet(userId);

    const speciesData = this.species[updatedPet.species] || this.species.dragon;
    const mood = this.getMood(updatedPet);
    const traits = updatedPet.traits
      .split(",")
      .filter((t) => t)
      .join(", ");
    const expToNextLevel = updatedPet.level * 100 - updatedPet.experience;

    let display = `${speciesData.emoji}  *Your Pet*\n`;
    display += `━━━━━━━━━━━━━━━━━━━━━\n`;
    display += `*Name:* ${updatedPet.name}\n`;
    display += `*Species:* ${speciesData.name}\n`;
    display += `*Level:* ${updatedPet.level}    *Bond:* ${updatedPet.bond}/100\n`;
    display += `*EXP:* ${expToNextLevel} to next level\n\n`;

    display += `*Happiness:*\n`;
    display += `└ ${this.createProgressBar(updatedPet.happiness)}\n`;

    display += `*Energy:*\n`;
    display += `└ ${this.createProgressBar(updatedPet.energy)}\n`;

    display += `*Hunger:*\n`;
    display += `└ ${this.createProgressBar(updatedPet.hunger)}\n\n`;

    display += `*Mood:* ${mood}\n`;
    display += `*Traits:* ${traits || "None"}\n`;

    if (updatedPet.giftReady) {
      display += `*Gift:* 🎁 Ready!\n`;
      display += `💡 *Tip:* Gift is ready! Use -pet gift\n\n`;
    } else {
      display += `*Gift:* Not ready (unlock at levels 5, 10, 15...)\n\n`;
    }

    display += `_Actions:_ -pet play | feed | train | gift | traits | name <name>\n`;
    display += `_Create:_ -pet create <name> <dragon/phoenix/unicorn/griffin/hydra>`;

    return display;
  }

  async decayStats(pet) {
    const now = Date.now();
    const hoursSinceLastFed = (now - pet.lastFed) / (60 * 60 * 1000);
    const hoursSinceLastPlayed = (now - pet.lastPlayed) / (60 * 60 * 1000);

    // Decay hunger (5% per hour)
    const hungerDecay = Math.floor(hoursSinceLastFed * 5);
    const newHunger = Math.max(0, pet.hunger - hungerDecay);

    // Decay happiness (3% per hour if not played)
    const happinessDecay = Math.floor(hoursSinceLastPlayed * 3);
    const newHappiness = Math.max(0, pet.happiness - happinessDecay);

    // Restore energy naturally (10% per hour)
    const energyRestore = Math.floor(hoursSinceLastPlayed * 10);
    const newEnergy = Math.min(100, pet.energy + energyRestore);

    if (hungerDecay > 0 || happinessDecay > 0 || energyRestore > 0) {
      await this.updatePet(pet.userId, {
        hunger: newHunger,
        happiness: newHappiness,
        energy: newEnergy,
      });
    }
  }

  async getLeaderboard(limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT name, species, level, bond FROM pets 
         ORDER BY level DESC, bond DESC 
         LIMIT ?`,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }
}

module.exports = PetService;
