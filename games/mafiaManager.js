// Mafia / Werewolf-style social deduction game for WhatsApp groups.
// Secret night actions are collected via direct messages (DMs) to the bot,
// day discussion + lynch voting happen in the group. One game per group.
//
// The MafiaManager owns the live game state, timers, and the WhatsApp socket
// so it can send messages proactively (night prompts, phase changes). It is
// created once in index.js and shared with the CommandHandler.

const LOBBY_TIMEOUT_MS = 3 * 60 * 1000; // auto-cancel an idle lobby
const NIGHT_DURATION_MS = 90 * 1000;
const DAY_DURATION_MS = 120 * 1000;
const VOTE_DURATION_MS = 60 * 1000;
const MIN_PLAYERS = 4;
const MAX_PLAYERS = 15;

const ROLE = {
  MAFIA: "Mafia",
  DON: "Don",
  SHERIFF: "Sheriff",
  DOCTOR: "Doctor",
  MANIAC: "Maniac",
  LOVER: "Lover",
  CIVILIAN: "Civilian",
};

const MAFIA_ROLES = new Set([ROLE.MAFIA, ROLE.DON]);

const ROLE_INFO = {
  [ROLE.MAFIA]: "🔫 You're *Mafia*. Each night, agree with your team on who to eliminate.",
  [ROLE.DON]: "🎩 You're the *Don* (mafia leader). You pick the kill, and can check one player each night to find the Sheriff.",
  [ROLE.SHERIFF]: "🕵️ You're the *Sheriff*. Each night, check one player to learn if they're Mafia.",
  [ROLE.DOCTOR]: "💉 You're the *Doctor*. Each night, heal one player to save them from death.",
  [ROLE.MANIAC]: "🔪 You're the *Maniac*. You kill alone each night and win if you're the last one standing.",
  [ROLE.LOVER]: "💋 You're the *Lover*. Each night, visit one player and block their night action.",
  [ROLE.CIVILIAN]: "👤 You're a *Civilian*. No night powers - use logic and your vote by day to find the Mafia.",
};

class MafiaManager {
  constructor(economyStore = null) {
    this.economyStore = economyStore;
    this.sock = null;
    this.games = new Map(); // groupJid -> game
    this.rewardWin = 300;
    this.rewardSurvive = 100;
  }

  setSock(sock) {
    this.sock = sock;
  }

  // ---- small helpers -------------------------------------------------------

  userKey(jid = "") {
    const base = String(jid).split("@")[0].split(":")[0];
    const digits = base.replace(/[^0-9]/g, "");
    return digits || base;
  }

  async send(jid, content) {
    if (!this.sock) return;
    try {
      await this.sock.sendMessage(jid, content);
    } catch (e) {
      console.error(`Mafia: failed to send to ${jid}:`, e.message);
    }
  }

  async dm(jid, text) {
    return this.send(jid, { text });
  }

  alivePlayers(game) {
    return [...game.players.values()].filter((p) => p.alive);
  }

  findGameByPlayer(senderJid) {
    const key = this.userKey(senderJid);
    for (const game of this.games.values()) {
      if (game.players.has(key)) return game;
    }
    return null;
  }

  clearTimers(game) {
    for (const t of game.timers) clearTimeout(t);
    game.timers = [];
  }

  // numbered list of alive players, optionally excluding some keys
  buildTargetList(game, excludeKeys = []) {
    const exclude = new Set(excludeKeys);
    return this.alivePlayers(game)
      .filter((p) => !exclude.has(p.key))
      .sort((a, b) => a.joinOrder - b.joinOrder);
  }

  // ---- lobby ---------------------------------------------------------------

  rules() {
    return `🕵️ *MAFIA — How to play*

A hidden-roles game. The *Mafia* secretly eliminate townsfolk at night; the *Town* tries to vote them out by day.

*Roles:* ${ROLE.DON}, ${ROLE.MAFIA}, ${ROLE.SHERIFF}, ${ROLE.DOCTOR}, ${ROLE.MANIAC}, ${ROLE.LOVER}, ${ROLE.CIVILIAN}

*Flow:*
🌙 Night — special roles get a DM from me to act secretly
☀️ Day — everyone discusses in the group
🗳️ Vote — \`-vote @player\` to lynch a suspect

*Commands:*
\`-mafia\` start a lobby · \`-join\` join · \`-leave\` leave
\`-mafiastart\` begin (host) · \`-players\` who's in
\`-vote @user\` vote · \`-mafia stop\` cancel

⚠️ Make sure you've DM'd me at least once so I can send your secret role!`;
  }

  createLobby(message, ctx) {
    const groupJid = message.groupId;
    const existing = this.games.get(groupJid);
    if (existing && existing.phase !== "ended") {
      if (existing.phase === "lobby") {
        return "🕵️ A Mafia lobby is already open here. Type `-join` to play, or `-mafiastart` to begin.";
      }
      return "🎮 A Mafia game is already in progress in this group. Finish or `-mafia stop` it first.";
    }

    const hostJid = ctx.senderJid || message.userId;
    const game = {
      groupJid,
      phase: "lobby",
      hostKey: this.userKey(hostJid),
      hostJid,
      players: new Map(),
      dayNumber: 0,
      nightActions: {},
      actionPrompts: new Map(), // userKey -> { role, targets:[key] }
      pendingNight: new Set(),
      votes: new Map(),
      timers: [],
      joinCounter: 0,
    };
    this.games.set(groupJid, game);

    // add the host as first player
    this.addPlayer(game, hostJid, ctx.senderName || "Host");

    const t = setTimeout(() => {
      const g = this.games.get(groupJid);
      if (g && g.phase === "lobby") {
        this.games.delete(groupJid);
        this.send(groupJid, { text: "🕵️ Mafia lobby timed out (not enough players). Start again with `-mafia`." });
      }
    }, LOBBY_TIMEOUT_MS);
    game.timers.push(t);

    return `🕵️ *MAFIA LOBBY OPEN!*\n\nHost: ${ctx.senderName || "Host"}\nPlayers can join with \`-join\` (need ${MIN_PLAYERS}-${MAX_PLAYERS}).\nHost starts the game with \`-mafiastart\`.\n\n⚠️ DM me once first so I can send you your secret role!\nNew to it? \`-mafia rules\``;
  }

  addPlayer(game, jid, name) {
    const key = this.userKey(jid);
    if (game.players.has(key)) return false;
    game.players.set(key, {
      key,
      jid,
      name: name || `+${key}`,
      role: null,
      alive: true,
      joinOrder: game.joinCounter++,
    });
    return true;
  }

  async joinLobby(message, ctx) {
    const game = this.games.get(message.groupId);
    if (!game || game.phase !== "lobby") {
      return "❌ No open Mafia lobby. Start one with `-mafia`.";
    }
    if (game.players.size >= MAX_PLAYERS) {
      return `❌ Lobby is full (${MAX_PLAYERS} players).`;
    }
    const jid = ctx.senderJid || message.userId;
    const name = ctx.senderName || "Player";
    if (!this.addPlayer(game, jid, name)) {
      return "✅ You're already in the lobby.";
    }

    // Verify we can DM this player (secret roles need DMs)
    await this.dm(
      jid,
      `✅ You joined the Mafia game in the group. I'll DM your secret role here when the host starts. Good luck! 🕵️`,
    );

    return `✅ ${name} joined! (${game.players.size}/${MAX_PLAYERS})\n${game.players.size >= MIN_PLAYERS ? "Host can `-mafiastart` whenever ready." : `Need ${MIN_PLAYERS - game.players.size} more to start.`}`;
  }

  leaveLobby(message, ctx) {
    const game = this.games.get(message.groupId);
    if (!game || game.phase !== "lobby") return null;
    const key = this.userKey(ctx.senderJid || message.userId);
    if (!game.players.has(key)) return "You're not in the lobby.";
    game.players.delete(key);
    if (game.players.size === 0) {
      this.clearTimers(game);
      this.games.delete(message.groupId);
      return "🕵️ Lobby empty - game cancelled.";
    }
    return `👋 ${ctx.senderName || "Player"} left. (${game.players.size}/${MAX_PLAYERS})`;
  }

  listPlayers(message, ctx) {
    const game = this.games.get(message.groupId);
    if (!game || game.phase === "ended") return "No active Mafia game. `-mafia` to start.";
    const list = this.buildTargetList(game)
      .map((p, i) => `${i + 1}. ${p.name}`)
      .join("\n");
    const header =
      game.phase === "lobby"
        ? `🕵️ *Lobby* (${game.players.size}/${MAX_PLAYERS})`
        : `🎮 *Alive players* — Day ${game.dayNumber}`;
    return `${header}\n${list}`;
  }

  cancelGame(message, ctx) {
    const game = this.games.get(message.groupId);
    if (!game) return "No Mafia game to cancel.";
    // only host or group admins should cancel; keep it simple: host only
    const requester = this.userKey(ctx.senderJid || message.userId);
    if (requester !== game.hostKey && !ctx.isOwner) {
      return "Only the host can stop the game.";
    }
    this.clearTimers(game);
    this.games.delete(message.groupId);
    return "🛑 Mafia game cancelled.";
  }

  // ---- role assignment & start --------------------------------------------

  rolesForCount(n) {
    const roles = [];
    const mafiaCount = n <= 5 ? 1 : n <= 8 ? 2 : n <= 11 ? 3 : 4;
    // Mafia team: first one is the Don (if 2+ mafia), rest plain Mafia
    for (let i = 0; i < mafiaCount; i++) {
      roles.push(i === 0 && mafiaCount >= 2 ? ROLE.DON : ROLE.MAFIA);
    }
    roles.push(ROLE.SHERIFF);
    roles.push(ROLE.DOCTOR);
    if (n >= 7) roles.push(ROLE.MANIAC);
    if (n >= 9) roles.push(ROLE.LOVER);
    while (roles.length < n) roles.push(ROLE.CIVILIAN);
    return roles.slice(0, n);
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async startGame(message, ctx) {
    const game = this.games.get(message.groupId);
    if (!game || game.phase !== "lobby") {
      return "❌ No lobby to start. Use `-mafia` first.";
    }
    const requester = this.userKey(ctx.senderJid || message.userId);
    if (requester !== game.hostKey && !ctx.isOwner) {
      return "Only the host can start the game.";
    }
    if (game.players.size < MIN_PLAYERS) {
      return `❌ Need at least ${MIN_PLAYERS} players (have ${game.players.size}).`;
    }

    this.clearTimers(game);

    const players = [...game.players.values()];
    const roles = this.shuffle(this.rolesForCount(players.length));
    this.shuffle(players);
    players.forEach((p, i) => {
      p.role = roles[i];
    });

    // DM each player their role
    const mafiaTeam = players.filter((p) => MAFIA_ROLES.has(p.role));
    for (const p of players) {
      let msg = `🎭 *Your role:* ${p.role}\n${ROLE_INFO[p.role]}`;
      if (MAFIA_ROLES.has(p.role) && mafiaTeam.length > 1) {
        const teammates = mafiaTeam
          .filter((m) => m.key !== p.key)
          .map((m) => m.name)
          .join(", ");
        msg += `\n\n🤝 Your mafia team: ${teammates}`;
      }
      await this.dm(p.jid, msg);
    }

    await this.send(game.groupJid, {
      text: `🎬 *The game begins!* ${players.length} players, roles sent by DM.\n\nThe town falls asleep... 🌙`,
    });

    await this.startNight(game);
    return null; // all output sent directly
  }

  // ---- night ---------------------------------------------------------------

  async startNight(game) {
    game.phase = "night";
    game.dayNumber += 1;
    game.nightActions = { mafiaVotes: {}, heal: null, maniac: null, block: null, sheriffCheck: null, donCheck: null };
    game.actionPrompts.clear();
    game.pendingNight.clear();
    this.clearTimers(game);

    await this.send(game.groupJid, {
      text: `🌙 *NIGHT ${game.dayNumber}*\nEveryone sleeps. Special roles - check your DMs and act fast! (${Math.round(NIGHT_DURATION_MS / 1000)}s)`,
    });

    const alive = this.alivePlayers(game);
    const mafiaTeam = alive.filter((p) => MAFIA_ROLES.has(p.role));
    const mafiaKeys = mafiaTeam.map((p) => p.key);

    for (const p of alive) {
      let targets = null;
      if (MAFIA_ROLES.has(p.role)) {
        targets = this.buildTargetList(game, mafiaKeys); // can't kill teammates
      } else if (p.role === ROLE.SHERIFF || p.role === ROLE.DOCTOR || p.role === ROLE.MANIAC || p.role === ROLE.LOVER) {
        targets = this.buildTargetList(game, [p.key]); // can't target self
      }
      if (!targets) continue;

      const prompt = this.actionVerb(p.role);
      const list = targets.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
      game.actionPrompts.set(p.key, { role: p.role, targets: targets.map((t) => t.key) });
      game.pendingNight.add(p.key);
      await this.dm(
        p.jid,
        `🌙 *Night ${game.dayNumber}* — ${prompt}\n\n${list}\n\nReply with the *number* of your target.`,
      );
    }

    if (game.pendingNight.size === 0) {
      // nobody has a night action (all civilians somehow) - go straight to day
      await this.resolveNight(game);
      return;
    }

    const t = setTimeout(() => {
      const g = this.games.get(game.groupJid);
      if (g && g.phase === "night") this.resolveNight(g);
    }, NIGHT_DURATION_MS);
    game.timers.push(t);
  }

  actionVerb(role) {
    switch (role) {
      case ROLE.DON:
        return "Choose who the Mafia kills (and you also see if your pick is the Sheriff):";
      case ROLE.MAFIA:
        return "Choose who to kill tonight:";
      case ROLE.SHERIFF:
        return "Choose who to investigate (Mafia or not?):";
      case ROLE.DOCTOR:
        return "Choose who to heal tonight:";
      case ROLE.MANIAC:
        return "Choose your victim:";
      case ROLE.LOVER:
        return "Choose who to visit (blocks their night action):";
      default:
        return "Act:";
    }
  }

  // Handle a DM that may be a night action. Returns true if consumed.
  async handleDM(senderJid, text) {
    const game = this.findGameByPlayer(senderJid);
    if (!game || game.phase !== "night") return false;
    const key = this.userKey(senderJid);
    const prompt = game.actionPrompts.get(key);
    if (!prompt || !game.pendingNight.has(key)) return false;

    const num = parseInt(String(text).trim(), 10);
    if (Number.isNaN(num) || num < 1 || num > prompt.targets.length) {
      await this.dm(senderJid, `❌ Reply with a number between 1 and ${prompt.targets.length}.`);
      return true; // consumed (it was an attempt at a night action)
    }
    const targetKey = prompt.targets[num - 1];
    const target = game.players.get(targetKey);
    const actor = game.players.get(key);

    // record action by role
    switch (prompt.role) {
      case ROLE.DON:
        game.nightActions.mafiaVotes[key] = targetKey;
        game.nightActions.donCheck = targetKey;
        await this.dm(senderJid, `🎩 Kill vote set: *${target.name}*. ${target.role === ROLE.SHERIFF ? "🔎 They ARE the Sheriff!" : "🔎 They are NOT the Sheriff."}`);
        break;
      case ROLE.MAFIA:
        game.nightActions.mafiaVotes[key] = targetKey;
        await this.dm(senderJid, `🔫 Kill vote set: *${target.name}*.`);
        break;
      case ROLE.SHERIFF:
        game.nightActions.sheriffCheck = { by: key, target: targetKey };
        await this.dm(senderJid, `🕵️ *${target.name}* is ${MAFIA_ROLES.has(target.role) ? "🔴 *MAFIA*" : "🟢 *not Mafia*"}.`);
        break;
      case ROLE.DOCTOR:
        game.nightActions.heal = targetKey;
        await this.dm(senderJid, `💉 You'll protect *${target.name}* tonight.`);
        break;
      case ROLE.MANIAC:
        game.nightActions.maniac = targetKey;
        await this.dm(senderJid, `🔪 Target locked: *${target.name}*.`);
        break;
      case ROLE.LOVER:
        game.nightActions.block = targetKey;
        await this.dm(senderJid, `💋 You'll visit *${target.name}* and block their action.`);
        break;
      default:
        return true;
    }

    game.pendingNight.delete(key);
    if (game.pendingNight.size === 0) {
      await this.resolveNight(game);
    }
    return true;
  }

  async resolveNight(game) {
    if (game.phase !== "night") return;
    this.clearTimers(game);

    const { mafiaVotes, heal, maniac, block, sheriffCheck, donCheck } = game.nightActions;

    // Apply Lover block: blocked player's action is cancelled
    let effHeal = heal;
    let effManiac = maniac;
    let effMafiaVotes = { ...mafiaVotes };
    if (block) {
      const blocked = game.players.get(block);
      if (blocked) {
        if (blocked.role === ROLE.DOCTOR) effHeal = null;
        if (blocked.role === ROLE.MANIAC) effManiac = null;
        if (MAFIA_ROLES.has(blocked.role)) delete effMafiaVotes[blocked.key];
      }
    }

    // Tally mafia kill (majority of submitted votes, ties -> random)
    let mafiaTarget = null;
    const tally = {};
    for (const tk of Object.values(effMafiaVotes)) tally[tk] = (tally[tk] || 0) + 1;
    const entries = Object.entries(tally);
    if (entries.length) {
      const max = Math.max(...entries.map(([, c]) => c));
      const top = entries.filter(([, c]) => c === max).map(([k]) => k);
      mafiaTarget = top[Math.floor(Math.random() * top.length)];
    }

    // Determine deaths (heal saves one target)
    const deaths = new Set();
    if (mafiaTarget && mafiaTarget !== effHeal) deaths.add(mafiaTarget);
    if (effManiac && effManiac !== effHeal) deaths.add(effManiac);

    const deadNames = [];
    for (const dk of deaths) {
      const p = game.players.get(dk);
      if (p && p.alive) {
        p.alive = false;
        deadNames.push(`💀 *${p.name}* (${p.role})`);
      }
    }

    let announce = `☀️ *DAY ${game.dayNumber}* — the town wakes up.\n\n`;
    if (deadNames.length) {
      announce += `Last night we lost:\n${deadNames.join("\n")}`;
    } else {
      announce += `Somehow... *nobody died* last night. 😮`;
    }

    const over = await this.checkWin(game, announce);
    if (over) return;

    await this.startDay(game, announce);
  }

  // ---- day & voting --------------------------------------------------------

  async startDay(game, prefix = "") {
    game.phase = "day";
    game.votes = new Map();
    this.clearTimers(game);

    const alive = this.buildTargetList(game);
    const list = alive.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
    await this.send(game.groupJid, {
      text: `${prefix}\n\n🗣️ *Discuss!* Who's the Mafia? You have ${Math.round(DAY_DURATION_MS / 1000)}s.\n\nAlive:\n${list}\n\nWhen ready, vote with \`-vote @player\`.`,
    });

    const t = setTimeout(() => {
      const g = this.games.get(game.groupJid);
      if (g && g.phase === "day") this.startVoting(g);
    }, DAY_DURATION_MS);
    game.timers.push(t);
  }

  async startVoting(game) {
    game.phase = "voting";
    game.votes = new Map();
    this.clearTimers(game);
    await this.send(game.groupJid, {
      text: `🗳️ *VOTING TIME!* (${Math.round(VOTE_DURATION_MS / 1000)}s)\nVote to lynch with \`-vote @player\`. Most votes is eliminated. \`-vote skip\` to abstain.`,
    });
    const t = setTimeout(() => {
      const g = this.games.get(game.groupJid);
      if (g && g.phase === "voting") this.resolveVotes(g);
    }, VOTE_DURATION_MS);
    game.timers.push(t);
  }

  async handleVote(args, message, ctx) {
    const game = this.games.get(message.groupId);
    if (!game || (game.phase !== "voting" && game.phase !== "day")) {
      return null;
    }
    const voterKey = this.userKey(ctx.senderJid || message.userId);
    const voter = game.players.get(voterKey);
    if (!voter || !voter.alive) {
      return "💀 Only living players can vote.";
    }
    // If voting during day, kick off the voting phase implicitly
    if (game.phase === "day") {
      await this.startVoting(game);
    }

    const arg = String(args[0] || "").toLowerCase();
    if (arg === "skip" || arg === "abstain") {
      game.votes.set(voterKey, "skip");
    } else {
      const targetJid = this.getTargetJid(message);
      let targetKey = null;
      if (targetJid) {
        targetKey = this.userKey(targetJid);
      } else if (/^\d+$/.test(arg)) {
        const list = this.buildTargetList(game);
        const idx = parseInt(arg, 10) - 1;
        if (list[idx]) targetKey = list[idx].key;
      }
      if (!targetKey || !game.players.has(targetKey) || !game.players.get(targetKey).alive) {
        return "❌ Vote a living player: `-vote @user` (or `-vote <number>`, `-vote skip`).";
      }
      game.votes.set(voterKey, targetKey);
    }

    // If everyone alive has voted, resolve early
    const aliveCount = this.alivePlayers(game).length;
    if (game.votes.size >= aliveCount) {
      await this.resolveVotes(game);
      return null;
    }
    const target = game.votes.get(voterKey);
    const targetName = target === "skip" ? "skip" : game.players.get(target)?.name;
    return `🗳️ ${voter.name} voted: *${targetName}* (${game.votes.size}/${aliveCount})`;
  }

  async resolveVotes(game) {
    if (game.phase !== "voting") return;
    this.clearTimers(game);

    const tally = {};
    for (const tk of game.votes.values()) {
      if (tk === "skip") continue;
      tally[tk] = (tally[tk] || 0) + 1;
    }
    const entries = Object.entries(tally);
    let lynched = null;
    if (entries.length) {
      const max = Math.max(...entries.map(([, c]) => c));
      const top = entries.filter(([, c]) => c === max).map(([k]) => k);
      // tie = no lynch (hung jury)
      if (top.length === 1) lynched = top[0];
    }

    let announce;
    if (lynched) {
      const p = game.players.get(lynched);
      p.alive = false;
      announce = `⚖️ The town has spoken. *${p.name}* is lynched.\nThey were... ${MAFIA_ROLES.has(p.role) ? "🔴" : p.role === ROLE.MANIAC ? "🔪" : "🟢"} *${p.role}*.`;
    } else {
      announce = `⚖️ No majority - *nobody* is lynched today.`;
    }

    const over = await this.checkWin(game, announce);
    if (over) return;

    await this.send(game.groupJid, { text: `${announce}\n\nNight falls again... 🌙` });
    await this.startNight(game);
  }

  getTargetJid(message) {
    if (message?.quoted?.userId) return message.quoted.userId;
    if (Array.isArray(message?.mentions) && message.mentions.length > 0) {
      return message.mentions[0];
    }
    return null;
  }

  // ---- win conditions ------------------------------------------------------

  async checkWin(game, prefix = "") {
    const alive = this.alivePlayers(game);
    const mafia = alive.filter((p) => MAFIA_ROLES.has(p.role));
    const maniac = alive.filter((p) => p.role === ROLE.MANIAC);
    const town = alive.filter((p) => !MAFIA_ROLES.has(p.role) && p.role !== ROLE.MANIAC);

    let winner = null; // "town" | "mafia" | "maniac"
    if (mafia.length === 0 && maniac.length === 0) {
      winner = "town";
    } else if (maniac.length === 1 && alive.length <= 2 && mafia.length === 0) {
      winner = "maniac";
    } else if (mafia.length > 0 && mafia.length >= town.length + maniac.length) {
      winner = "mafia";
    }

    if (!winner) return false;

    // Build the reveal + rewards
    let winners = [];
    if (winner === "town") winners = [...game.players.values()].filter((p) => !MAFIA_ROLES.has(p.role) && p.role !== ROLE.MANIAC);
    if (winner === "mafia") winners = [...game.players.values()].filter((p) => MAFIA_ROLES.has(p.role));
    if (winner === "maniac") winners = [...game.players.values()].filter((p) => p.role === ROLE.MANIAC);

    if (this.economyStore) {
      for (const p of winners) {
        const reward = this.rewardWin + (p.alive ? this.rewardSurvive : 0);
        try {
          this.economyStore.addBalance(p.jid, reward, { won: true });
        } catch (e) {}
      }
    }

    const reveal = [...game.players.values()]
      .sort((a, b) => a.joinOrder - b.joinOrder)
      .map((p) => `${p.alive ? "🟢" : "💀"} ${p.name} — ${p.role}`)
      .join("\n");

    const banner =
      winner === "town"
        ? "🎉 *TOWN WINS!* The Mafia has been wiped out."
        : winner === "mafia"
          ? "🔫 *MAFIA WINS!* They've taken over the town."
          : "🔪 *MANIAC WINS!* The lone killer outlasted everyone.";

    this.clearTimers(game);
    game.phase = "ended";
    this.games.delete(game.groupJid);

    await this.send(game.groupJid, {
      text: `${prefix}\n\n${banner}\n\n*Final roles:*\n${reveal}\n\n💰 Winners earned ${this.rewardWin}(+${this.rewardSurvive} if alive) coins!\nPlay again with \`-mafia\`.`,
    });
    return true;
  }
}

module.exports = MafiaManager;
