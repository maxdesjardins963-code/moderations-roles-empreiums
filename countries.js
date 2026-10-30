'use strict';

const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

const SPAWN_INTERVAL_MS = (7 * 60 + 30) * 1000; // One country spawns every 7 minutes and 30 seconds
const FARM_COOLDOWN_MS = 60 * 1000; // 1 farm par minute
const WAR_COOLDOWN_MS = 5 * 60 * 1000; // One war every 5 minutes
const REQUEST_TTL_MS = 5 * 60 * 1000; // Trade, alliance, and faction requests expire after 5 minutes
const MAX_MASTERY = 50;
const MASTERED_NEEDED = 3; // Countries that must reach mastery 50 to use /redeem
const DUPLICATE_BONUS = 5; // Mastery gained when you claim a country you already own
const MAX_ALLIES = 10;
const MAX_FACTION_MEMBERS = 15;
const WAR_LOSS_PENALTY = 3; // Mastery lost by your country when you lose a war
const WAR_DEFENDER_BONUS = 3;

// These members start with two randomly chosen mastered countries, one time only.
const STARTER_USER_IDS = ['1378390229626519573', '1289624819771510888'];
const STARTER_MASTERED_COUNT = 2;

// The only channel where the game runs (spawns, claims, and slash commands).
const COUNTRY_CHANNEL_ID = process.env.COUNTRY_CHANNEL_ID || '1565678201315790848';
const EMBED_PERMS_ROLE_ID = process.env.EMBED_PERMS_ROLE_ID; // role donne par /redeem
const GUILD_ID = process.env.GUILD_ID; // Optional: register commands instantly

/* ------------------------------------------------------------------ */
/* The 100 countries of 1750: [name, emoji, trade %, sociability %]   */
/* Rarity is calculated from trade + sociability.                      */
/* ------------------------------------------------------------------ */

const RAW_COUNTRIES = [
  ['Kingdom of France', '🥖', 80, 85],
  ['Great Britain', '☕', 90, 70],
  ['Dutch Republic', '🌷', 95, 75],
  ['Spain', '🐂', 75, 60],
  ['Portugal', '⛵', 85, 65],
  ['Ottoman Empire', '🕌', 85, 70],
  ['Qing China', '🏯', 85, 55],
  ['Mughal Empire', '🐘', 80, 60],
  ['Russian Empire', '🐻', 55, 45],
  ['Prussia', '🦅', 50, 40],
  ['Habsburg Austria', '🎻', 60, 75],
  ['Sweden', '🪓', 55, 50],
  ['Denmark-Norway', '⚓', 70, 55],
  ['Republic of Venice', '🎭', 90, 80],
  ['Republic of Genoa', '⚖️', 80, 60],
  ['Papal States', '⛪', 45, 70],
  ['Poland-Lithuania', '🏇', 55, 65],
  ['Persia', '🦁', 65, 50],
  ['Tokugawa Japan', '🌸', 40, 35],
  ['Joseon Korea', '🎎', 30, 40],
  ['Siam', '🛕', 60, 65],
  ['Konbaung Burma', '🐅', 45, 40],
  ['Dai Viet', '🐉', 50, 55],
  ['Morocco', '🏜️', 60, 55],
  ['Ethiopia', '⛰️', 35, 50],
  ['Ashanti Empire', '🥁', 70, 60],
  ['Dahomey', '🗡️', 60, 35],
  ['Oyo Empire', '🐎', 65, 55],
  ['Kingdom of Kongo', '🌴', 55, 60],
  ['Kingdom of Benin', '🗿', 70, 55],
  ['Bornu Empire', '🐪', 60, 45],
  ['New France', '🦫', 70, 65],
  ['New Spain', '🌮', 75, 60],
  ['Viceroyalty of Peru', '⛏️', 80, 50],
  ['Portuguese Brazil', '🦜', 75, 55],
  ['Thirteen Colonies', '🔔', 65, 70],
  ['Iroquois Confederacy', '🏹', 45, 80],
  ['Cherokee Nation', '🪶', 40, 70],
  ['Comanche', '🐴', 35, 45],
  ['Kingdom of Naples', '🍕', 55, 80],
  ['Tuscany', '🍷', 65, 75],
  ['Savoy-Sardinia', '🏔️', 40, 50],
  ['Bavaria', '🍺', 45, 70],
  ['Saxony', '🎨', 50, 60],
  ['Hanover', '🌲', 45, 50],
  ['Hesse-Kassel', '🛡️', 35, 40],
  ['Swiss Confederacy', '🧀', 55, 75],
  ['Knights of Malta', '✝️', 60, 55],
  ['Courland', '🌊', 50, 45],
  ['Crimean Khanate', '🐺', 40, 35],
  ['Cossack Hetmanate', '🪕', 35, 60],
  ['Georgia', '🍇', 40, 65],
  ['Khiva Khanate', '🏺', 45, 40],
  ['Bukhara Emirate', '🧿', 60, 50],
  ['Oman', '🌶️', 75, 50],
  ['Yemen', '🪔', 55, 45],
  ['Swahili Coast', '🧭', 70, 55],
  ['Mutapa', '🪙', 55, 40],
  ['Rozvi Empire', '🏛️', 50, 40],
  ['Lunda Empire', '🛖', 45, 55],
  ['Bambara Empire', '🌾', 45, 45],
  ['Fouta Djallon', '📿', 40, 55],
  ['Sennar Sultanate', '🐫', 55, 40],
  ['Darfur', '🌵', 40, 45],
  ['Merina Madagascar', '🌺', 45, 60],
  ['Hawaii', '🌋', 35, 75],
  ['Tahiti', '🥥', 30, 85],
  ['Aotearoa Maori', '🛶', 25, 55],
  ['Aboriginal Australia', '🪃', 20, 65],
  ['Maratha Confederacy', '🚩', 65, 60],
  ['Gorkha Nepal', '🕉️', 40, 50],
  ['Bhutan', '🐲', 25, 45],
  ['Tibet', '🪷', 30, 60],
  ['Dzungar Khanate', '🐎', 40, 35],
  ['Ryukyu Kingdom', '🐚', 80, 70],
  ['Kingdom of Kandy', '🍃', 50, 55],
  ['Aceh', '🌿', 70, 50],
  ['Mataram Java', '🪘', 60, 60],
  ['Sulu Sultanate', '🏴‍☠️', 65, 40],
  ['Brunei', '🪵', 55, 50],
  ['Lan Xang Laos', '🍚', 45, 60],
  ['Cambodia', '🌅', 40, 50],
  ['Wallachia', '🧛', 45, 50],
  ['Moldavia', '🦬', 40, 55],
  ['Republic of Ragusa', '🏰', 85, 75],
  ['Free City of Hamburg', '🚢', 85, 65],
  ['Bremen and the Hansa', '🧂', 80, 60],
  ['Kingdom of Ireland', '🍀', 45, 85],
  ['Scotland', '🥃', 45, 80],
  ['Iceland', '🧊', 25, 55],
  ['Greenland Inuit', '❄️', 20, 60],
  ['Louisiana', '🎷', 55, 70],
  ['Spanish Cuba', '🚬', 70, 70],
  ['Jamaica', '🍹', 75, 65],
  ['Saint-Domingue', '🍬', 85, 40],
  ['Barbados', '🍠', 70, 55],
  ['Rio de la Plata', '🧉', 55, 55],
  ['Mapuche Araucania', '🔥', 25, 50],
  ['Guarani Missions', '🎶', 40, 70],
  ['Mosquito Coast', '🦈', 40, 45],
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function rarityOf(trade, sociable) {
  const total = trade + sociable;
  if (total >= 150) return 'Legendary';
  if (total >= 115) return 'Rare';
  return 'Common';
}

const COUNTRIES = RAW_COUNTRIES.map(([name, emoji, trade, sociable]) => ({
  id: slugify(name),
  name,
  emoji,
  trade,
  sociable,
  rarity: rarityOf(trade, sociable),
}));

const BY_ID = new Map(COUNTRIES.map((c) => [c.id, c]));

// Spawn weights by rarity (Legendary countries are the hardest to find).
const RARITY_WEIGHTS = { Common: 60, Rare: 30, Legendary: 10 };
const RARITY_COLORS = { Common: 0x95a5a6, Rare: 0x3498db, Legendary: 0xf1c40f };

function pickCountry() {
  const roll = Math.random() * 100;
  let tier = 'Common';
  if (roll >= RARITY_WEIGHTS.Common + RARITY_WEIGHTS.Rare) tier = 'Legendary';
  else if (roll >= RARITY_WEIGHTS.Common) tier = 'Rare';
  const pool = COUNTRIES.filter((c) => c.rarity === tier);
  const list = pool.length ? pool : COUNTRIES;
  return list[Math.floor(Math.random() * list.length)];
}

/* ------------------------------------------------------------------ */
/* Persistent storage                                                 */
/* ------------------------------------------------------------------ */

let dataFile;
let store = { users: {}, factions: {} };

function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (!store || typeof store !== 'object' || typeof store.users !== 'object') throw new Error('Invalid format');
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[countries] Could not read the data file.', error.message);
    store = { users: {}, factions: {} };
  }
  if (!store.factions || typeof store.factions !== 'object') store.factions = {};
}

function saveStore() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, dataFile);
}

// Create the user if needed and fill in missing fields from older saves.
function getUser(userId) {
  if (!store.users[userId]) store.users[userId] = {};
  const u = store.users[userId];
  if (!u.countries) u.countries = {};
  if (typeof u.lastFarm !== 'number') u.lastFarm = 0;
  if (typeof u.lastWar !== 'number') u.lastWar = 0;
  if (typeof u.redeemed !== 'boolean') u.redeemed = false;
  if (!Array.isArray(u.allies)) u.allies = [];
  if (u.faction === undefined) u.faction = null;
  if (typeof u.wins !== 'number') u.wins = 0;
  if (typeof u.losses !== 'number') u.losses = 0;
  return u;
}

// Read-only: does not create a user.
function peekUser(userId) {
  return userId && store.users[userId] ? getUser(userId) : null;
}

function masteredCount(user) {
  return Object.values(user.countries).filter((m) => m >= MAX_MASTERY).length;
}

function userPower(user) {
  let total = 0;
  for (const m of Object.values(user.countries)) total += 2 + m + (m >= MAX_MASTERY ? 20 : 0);
  return total;
}

function userFaction(user) {
  return user.faction ? store.factions[user.faction] || null : null;
}

function factionPower(faction) {
  return faction.members.reduce((sum, id) => sum + userPower(getUser(id)), 0);
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Give each member in STARTER_USER_IDS two random mastered countries, once only.
function grantStarters() {
  let changed = false;
  for (const id of STARTER_USER_IDS) {
    const u = getUser(id);
    if (u.starterGiven) continue;
    const pool = shuffle(COUNTRIES.filter((c) => u.countries[c.id] === undefined));
    for (const c of pool.slice(0, STARTER_MASTERED_COUNT)) u.countries[c.id] = MAX_MASTERY;
    u.starterGiven = true;
    changed = true;
  }
  if (changed) saveStore();
}

/* ------------------------------------------------------------------ */
/* Embeds                                                              */
/* ------------------------------------------------------------------ */

function bar(value, max = MAX_MASTERY, size = 10) {
  const filled = Math.round((Math.min(value, max) / max) * size);
  return `${'#'.repeat(filled)}${'-'.repeat(size - filled)}`;
}

function spawnEmbed(country, state, winnerId) {
  const embed = new EmbedBuilder()
    .setColor(RARITY_COLORS[country.rarity])
    .setTitle(`${country.emoji} A wild country appeared: ${country.name}`)
    .setDescription(
      `*The year is 1750. Envoys of **${country.name}** are at your gates.*\n\n` +
        `**Rarity:** ${country.rarity}\n` +
        `**Trade:** ${country.trade}%\n` +
        `**Sociable:** ${country.sociable}%`
    );
  if (state === 'open') embed.setFooter({ text: 'The first member to press the button wins this country.' });
  if (state === 'claimed') embed.addFields({ name: 'Claimed by', value: `<@${winnerId}>` });
  if (state === 'expired') embed.setFooter({ text: 'Nobody claimed it. The envoys sailed away.' });
  return embed;
}

function claimRow(spawnId, disabled) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`claim:${spawnId}`)
      .setLabel('Claim this country')
      .setEmoji('🏳️')
``      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
  );
}

function ephemeral(interaction, content) {
  return interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

/* ------------------------------------------------------------------ */
/* Spawner                                                             */
/* ------------------------------------------------------------------ */

let current = null; // { id, country, claimed, message }

async function expireCurrent() {
  if (!current || current.claimed) return;
  current.claimed = true;
  await current.message
    .edit({ embeds: [spawnEmbed(current.country, 'expired')], components: [claimRow(current.id, true)] })
    .catch(() => {});
}

async function spawn(client) {
  try {
    if (!COUNTRY_CHANNEL_ID) return;
    const channel = await client.channels.fetch(COUNTRY_CHANNEL_ID).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await expireCurrent();

    const country = pickCountry();
    const id = String(Date.now());
    const message = await channel.send({
      embeds: [spawnEmbed(country, 'open')],
      components: [claimRow(id, false)],
    });
    current = { id, country, claimed: false, message };
  } catch (error) {
    console.error('[countries] Spawn failed:', error.message);
  }
}

/* ------------------------------------------------------------------ */
/* Requests: trades, alliances, and faction invitations                */
/* Each request has Accept / Decline buttons that only the intended    */
/* recipient can use.                                                  */
/* ------------------------------------------------------------------ */

const pending = new Map(); // id -> { id, kind, fromId, targetId, data, embed, message, timer }

async function createRequest(interaction, { kind, targetId, data, title, description }) {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'This request expires in 5 minutes.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`req:${id}:accept`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`req:${id}:decline`).setLabel('Decline').setStyle(ButtonStyle.Danger)
  );

  await interaction.reply({
    content: `<@${targetId}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [targetId] },
  });

  const message = await interaction.fetchReply().catch(() => null);

  const req = { id, kind, fromId: interaction.user.id, targetId, data, embed, message };

  req.timer = setTimeout(async () => {
    if (!pending.delete(id) || !message) return;

    await message
      .edit({
        content: '',
        embeds: [EmbedBuilder.from(embed).setColor(0x95a5a6).setFooter({ text: 'Request expired.' })],
        components: [],
      })
      .catch(() => {});
  }, REQUEST_TTL_MS);

  pending.set(id, req);
}

const resolvers = {
  trade(req) {
    const { give, get } = req.data;
    const from = getUser(req.fromId);
    const to = getUser(req.targetId);
    const giveC = BY_ID.get(give);
    const getC = BY_ID.get(get);

    if (from.countries[give] === undefined) {
      return { ok: false, text: `<@${req.fromId}> no longer owns **${giveC.name}**.` };
    }

    if (to.countries[get] === undefined) {
      return { ok: false, text: `<@${req.targetId}> no longer owns **${getC.name}**.` };
    }

    if (to.countries[give] !== undefined) {
      return { ok: false, text: `<@${req.targetId}> already owns **${giveC.name}**.` };
    }

    if (from.countries[get] !== undefined) {
      return { ok: false, text: `<@${req.fromId}> already owns **${getC.name}**.` };
    }

    delete from.countries[give];
    delete to.countries[get];

    from.countries[get] = 0; // Mastery resets to zero after a trade
    to.countries[give] = 0;

    saveStore();

    return {
      ok: true,
      text: `${giveC.emoji} **${giveC.name}** → <@${req.targetId}>\n${getC.emoji} **${getC.name}** → <@${req.fromId}>\n\n*Mastery for traded countries resets to 0.*`,
    };
  },

  ally(req) {
    const a = getUser(req.fromId);
    const b = getUser(req.targetId);

    if (a.allies.includes(req.targetId)) {
      return { ok: false, text: 'You are already allies.' };
    }

    if (a.allies.length >= MAX_ALLIES) {
      return { ok: false, text: `<@${req.fromId}> already has ${MAX_ALLIES} allies.` };
    }

    if (b.allies.length >= MAX_ALLIES) {
      return { ok: false, text: `<@${req.targetId}> already has ${MAX_ALLIES} allies.` };
    }

    a.allies.push(req.targetId);
    b.allies.push(req.fromId);

    saveStore();

    return {
      ok: true,
      text: `<@${req.fromId}> and <@${req.targetId}> are now **allies**. They can no longer declare war on each other and receive a combat bonus.`,
    };
  },

  faction(req) {
    const faction = store.factions[req.data.factionId];
    const target = getUser(req.targetId);

    if (!faction) {
      return { ok: false, text: 'This faction no longer exists.' };
    }

    if (target.faction) {
      return { ok: false, text: `<@${req.targetId}> is already in a faction.` };
    }

    if (faction.members.length >= MAX_FACTION_MEMBERS) {
      return { ok: false, text: `Faction **${faction.name}** is full.` };
    }

    faction.members.push(req.targetId);
    target.faction = faction.id;

    saveStore();

    return {
      ok: true,
      text: `<@${req.targetId}> joined faction **${faction.name}**!`,
    };
  },
};

async function handleRequestButton(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const req = pending.get(id);

  if (!req) {
    return ephemeral(interaction, 'This request has expired or has already been handled.');
  }

  if (interaction.user.id !== req.targetId) {
    return ephemeral(interaction, 'This request was not sent to you.');
  }

  pending.delete(id);
  clearTimeout(req.timer);

  if (action === 'decline') {
    return interaction.update({
      content: '',
      embeds: [
        EmbedBuilder.from(req.embed)
          .setColor(0xed4245)
          .setFooter({ text: `Declined by ${interaction.user.username}.` }),
      ],
      components: [],
    });
  }

  const result = resolvers[req.kind](req);

  return interaction.update({
    content: '',
    embeds: [
      new EmbedBuilder()
        .setColor(result.ok ? 0x57f287 : 0xed4245)
        .setTitle(result.ok ? 'Accepted' : 'Unable to complete request')
        .setDescription(result.text),
    ],
    components: [],
    allowedMentions: { parse: [] },
  });
}

/* ------------------------------------------------------------------ */
/* Slash commands                                                      */
/* ------------------------------------------------------------------ */

const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('collection')
    .setDescription('Show your countries and their mastery')
    .addUserOption((o) => o.setName('member').setDescription('Another member (optional)')),

  new SlashCommandBuilder()
    .setName('farm')
    .setDescription('Farm one of your countries to raise its mastery')
    .addStringOption((o) =>
      o.setName('country').setDescription('The country to farm').setRequired(true).setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('redeem')
    .setDescription(`Redeem the Embed Perms role (needs ${MASTERED_NEEDED} countries at mastery ${MAX_MASTERY})`),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Server leaderboards')
    .addStringOption((o) =>
      o.setName('type')
        .setDescription('Which leaderboard do you want to view?')
        .addChoices(
          { name: 'Players', value: 'players' },
          { name: 'Factions', value: 'factions' },
          { name: 'Allies', value: 'allies' }
        )
    ),

  new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Offer a country trade to another member')
    .addUserOption((o) =>
      o.setName('member').setDescription('The member you want to trade with').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('give').setDescription('The country you are offering').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((o) =>
      o.setName('get').setDescription('The country you want in return').setRequired(true).setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('war')
    .setDescription('Declare war on a member to conquer one of their countries')
    .addUserOption((o) =>
      o.setName('member').setDescription('The member you want to attack').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('your_country').setDescription('The country you are sending into battle').setRequired(true).setAutocomplete(true)
    )
    .addStringOption((o) =>
      o.setName('target_country').setDescription('The country you want to conquer').setRequired(true).setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('ally')
    .setDescription('Manage your alliances')
    .addSubcommand((s) =>
      s.setName('add').setDescription('Propose an alliance')
        .addUserOption((o) => o.setName('member').setDescription('The member').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('remove').setDescription('End an alliance')
        .addUserOption((o) => o.setName('member').setDescription('The member').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('list').setDescription('List your allies')
        .addUserOption((o) => o.setName('member').setDescription('Another member (optional)'))
    ),

  new SlashCommandBuilder()
    .setName('faction')
    .setDescription('Manage factions')
    .addSubcommand((s) =>
      s.setName('create').setDescription('Create your faction')
        .addStringOption((o) =>
          o.setName('name')
            .setDescription('Faction name (3–20 characters)')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(20)
        )
    )
    .addSubcommand((s) =>
      s.setName('invite').setDescription('Invite a member to your faction')
        .addUserOption((o) => o.setName('member').setDescription('The member').setRequired(true))
    )
    .addSubcommand((s) => s.setName('leave').setDescription('Leave your faction'))
    .addSubcommand((s) =>
      s.setName('kick').setDescription('Remove a member from your faction')
        .addUserOption((o) => o.setName('member').setDescription('The member').setRequired(true))
    )
    .addSubcommand((s) => s.setName('disband').setDescription('Disband your faction (leader only)'))
    .addSubcommand((s) =>
      s.setName('info').setDescription('Faction information')
        .addUserOption((o) => o.setName('member').setDescription('The faction this member belongs to (optional)'))
    ),
].map((c) => c.toJSON());

const GAME_COMMANDS = new Set([
  'collection',
  'farm',
  'redeem',
  'leaderboard',
  'trade',
  'war',
  'ally',
  'faction',
]);

// Register slash commands, then check the configuration and report the results
// in the Render logs and, if configured, in LOG_CHANNEL_ID.
async function registerCommands(client) {
  const checks = [];
  const add = (ok, text) => checks.push({ ok, text });
  const expected = commandDefinitions.map((c) => c.name);

  // 1. GUILD_ID
  let guild = null;

  if (!GUILD_ID) {
    add(false, 'GUILD_ID is not set. Commands are registered globally and can take up to an hour to appear.');
  } else {
    guild = await client.guilds.fetch(GUILD_ID).catch(() => null);

    if (guild) {
      add(true, `GUILD_ID is set and the bot is in the server "${guild.name}" (${GUILD_ID}).`);
    } else {
      add(false, `GUILD_ID (${GUILD_ID}) does not match a server the bot is in. Falling back to global registration.`);
    }
  }

  // 2. Command registration
  const manager = guild ? guild.commands : client.application.commands;
  const scope = guild ? 'server' : 'global';

  try {
    await manager.set(commandDefinitions);

    const fetched = await manager.fetch();
    const names = [...fetched.values()].map((c) => c.name);
    const missing = expected.filter((name) => !names.includes(name));

    if (missing.length === 0) {
      add(true, `All ${expected.length} slash commands are registered (${scope}): ${expected.map((n) => `/${n}`).join(', ')}.`);
    } else {
      add(false, `Missing slash commands (${scope}): ${missing.map((n) => `/${n}`).join(', ')}.`);
    }
  } catch (error) {
    add(false, `Could not register slash commands (${scope}): ${error.message}. If this says Missing Access, re-invite the bot with the applications.commands scope.`);
  }

  // 3. Game channel
  const channel = await client.channels.fetch(COUNTRY_CHANNEL_ID).catch(() => null);

  if (!channel || !channel.isTextBased() || !channel.guild) {
    add(false, `Game channel ${COUNTRY_CHANNEL_ID} was not found or is not a text channel the bot can see.`);
  } else {
    const checkGuild = guild || channel.guild;

    if (GUILD_ID && channel.guild.id !== GUILD_ID) {
      add(false, `The game channel is in "${channel.guild.name}", which is not the server of GUILD_ID.`);
    }

    const me = channel.guild.members.me || (await channel.guild.members.fetchMe().catch(() => null));
    const perms = me ? channel.permissionsFor(me) : null;

    const needed = [
      ['ViewChannel', PermissionFlagsBits.ViewChannel],
      ['SendMessages', PermissionFlagsBits.SendMessages],
      ['EmbedLinks', PermissionFlagsBits.EmbedLinks],
    ];

    const lacking = perms
      ? needed.filter(([, flag]) => !perms.has(flag)).map(([name]) => name)
      : needed.map(([name]) => name);

    if (lacking.length === 0) {
      add(true, `Game channel #${channel.name} is reachable and the bot can post embeds there.`);
    } else {
      add(false, `In #${channel.name} the bot lacks: ${lacking.join(', ')}.`);
    }

    // 4. Reward role
    if (!EMBED_PERMS_ROLE_ID) {
      add(false, 'EMBED_PERMS_ROLE_ID is not set. /redeem cannot give the reward role.');
    } else {
      const role = await checkGuild.roles.fetch(EMBED_PERMS_ROLE_ID).catch(() => null);

      if (!role) {
        add(false, `Role ${EMBED_PERMS_ROLE_ID} (EMBED_PERMS_ROLE_ID) was not found in "${checkGuild.name}".`);
      } else if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        add(false, `The bot lacks the Manage Roles permission, so it cannot give "${role.name}".`);
      } else if (me.roles.highest.position <= role.position) {
        add(false, `The bot's highest role is not above "${role.name}". Move the bot role higher in Server Settings > Roles.`);
      } else {
        add(true, `Reward role "${role.name}" exists and the bot can give it.`);
      }
    }
  }

  // Startup report
  const allOk = checks.every((c) => c.ok);

  console.log(`[countries] Startup check: ${allOk ? 'everything is fine' : 'PROBLEMS FOUND'}`);

  for (const c of checks) {
    console.log(`[countries] ${c.ok ? 'OK     ' : 'PROBLEM'} ${c.text}`);
  }

  const logChannelId = process.env.LOG_CHANNEL_ID;

  if (logChannelId) {
    try {
      const logChannel = await client.channels.fetch(logChannelId);

      if (logChannel && logChannel.isTextBased()) {
        await logChannel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`Country Game Startup Check: ${allOk ? 'OK' : 'Problems found'}`)
              .setColor(allOk ? 0x57f287 : 0xed4245)
              .setDescription(
                checks.map((c) => `**${c.ok ? 'OK' : 'PROBLEM'}:** ${c.text}`).join('\n').slice(0, 4000)
              )
              .setTimestamp(),
          ],
        });
      }
    } catch (error) {
      console.error('[countries] Could not post the startup check in the log channel:', error.message);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Claim / collection / farm / redeem                                  */
/* ------------------------------------------------------------------ */

async function handleClaim(interaction) {
  const spawnId = interaction.customId.split(':')[1];

  if (!current || current.id !== spawnId || current.claimed) {
    return interaction.reply({
      content: 'Too late. Someone was faster, or the country already left.',
      flags: MessageFlags.Ephemeral,
    });
  }

  // Close the spawn synchronously so only one member can claim it.
  current.claimed = true;

  const country = current.country;
  const user = getUser(interaction.user.id);
  const owned = user.countries[country.id] !== undefined;

  if (owned) {
    user.countries[country.id] = Math.min(
      MAX_MASTERY,
      user.countries[country.id] + DUPLICATE_BONUS
    );
  } else {
    user.countries[country.id] = 0;
  }

  saveStore();

  await interaction.update({
    embeds: [spawnEmbed(country, 'claimed', interaction.user.id)],
    components: [claimRow(spawnId, true)],
  });

  await interaction
    .followUp({
      content: owned
        ? `You already owned **${country.name}**. Duplicate bonus: **+${DUPLICATE_BONUS} mastery** (now ${user.countries[country.id]}/${MAX_MASTERY}).`
        : `**${country.name}** is yours. Use \`/farm\` to raise its mastery.`,
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});
}

async function handleCollection(interaction) {
  const target = interaction.options.getUser('member') || interaction.user;
  const user = getUser(target.id);

  const entries = Object.entries(user.countries)
    .map(([id, mastery]) => ({ country: BY_ID.get(id), mastery }))
    .filter((e) => e.country)
    .sort((a, b) => b.mastery - a.mastery);

  if (!entries.length) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('Collection')
          .setDescription(`${target.username} has no countries yet.`),
      ],
    });
  }

  const shown = entries.slice(0, 25).map(
    ({ country, mastery }) =>
      `${country.emoji} **${country.name}** — ${mastery >= MAX_MASTERY ? 'MASTERED' : `${mastery}/${MAX_MASTERY}`}`
  );  const more = entries.length > 25 ? `\n...and ${entries.length - 25} more.` : '';
  const faction = userFaction(user);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Collection of ${target.username}`)
        .setDescription(
          `**Countries:** ${entries.length}/${COUNTRIES.length}\n` +
            `**Mastered:** ${masteredCount(user)}/${MASTERED_NEEDED} needed for Embed Perms\n` +
            `**Faction:** ${faction ? faction.name : 'None'}\n` +
            `**Allies:** ${user.allies.length}/${MAX_ALLIES}\n` +
            `**Wars:** ${user.wins} wins / ${user.losses} losses\n\n${shown.join('\n')}${more}`
        ),
    ],
  });
}

async function handleFarm(interaction) {
  const user = getUser(interaction.user.id);
  const countryId = interaction.options.getString('country');
  const country = BY_ID.get(countryId);

  if (!country || user.countries[countryId] === undefined) {
    return interaction.reply({
      content: 'You do not own that country.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (user.countries[countryId] >= MAX_MASTERY) {
    return interaction.reply({
      content: `**${country.name}** is already at mastery ${MAX_MASTERY}.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const now = Date.now();
  const wait = user.lastFarm + FARM_COOLDOWN_MS - now;

  if (wait > 0) {
    return interaction.reply({
      content: `You can farm again <t:${Math.ceil((now + wait) / 1000)}:R>.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  user.lastFarm = now;

  // Trade % determines the chance of a double harvest.
  // Sociability % determines the chance of improving another country.
  let gain = 1;
  const notes = [];

  if (Math.random() * 100 < country.trade) {
    gain += 1;
    notes.push('Trade caravans doubled the harvest (+1).');
  }

  user.countries[countryId] = Math.min(
    MAX_MASTERY,
    user.countries[countryId] + gain
  );

  if (Math.random() * 100 < country.sociable) {
    const others = Object.keys(user.countries).filter(
      (id) => id !== countryId && user.countries[id] < MAX_MASTERY
    );

    if (others.length) {
      const otherId = others[Math.floor(Math.random() * others.length)];
      user.countries[otherId] += 1;

      const other = BY_ID.get(otherId);
      notes.push(`Diplomacy paid off: **${other.name}** gained +1 mastery too.`);
    }
  }

  saveStore();

  const mastery = user.countries[countryId];
  const mastered = mastery >= MAX_MASTERY;

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(mastered ? 0xf1c40f : 0x57f287)
        .setTitle(`${country.emoji} ${country.name}`)
        .setDescription(
          `You gained **+${gain}** mastery.\n[${bar(mastery)}] **${mastery}/${MAX_MASTERY}**` +
            (notes.length ? `\n\n${notes.join('\n')}` : '') +
            (mastered
              ? `\n\n**${country.name} is now MASTERED!** (${masteredCount(user)}/${MASTERED_NEEDED})`
              : '')
        ),
    ],
  });
}

async function handleRedeem(interaction) {
  const user = getUser(interaction.user.id);
  const mastered = masteredCount(user);

  if (!EMBED_PERMS_ROLE_ID) {
    return interaction.reply({
      content: 'The reward role is not configured yet.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (mastered < MASTERED_NEEDED) {
    return interaction.reply({
      content: `You need **${MASTERED_NEEDED}** countries at mastery ${MAX_MASTERY}. You have **${mastered}**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    return interaction.reply({
      content: 'Could not find you in this server.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (member.roles.cache.has(EMBED_PERMS_ROLE_ID)) {
    return interaction.reply({
      content: 'You already have the Embed Perms role.',
      flags: MessageFlags.Ephemeral,
    });
  }

  try {
    await member.roles.add(
      EMBED_PERMS_ROLE_ID,
      'Redeemed with 3 mastered countries'
    );
  } catch (error) {
    console.error('[countries] Could not give the role:', error.message);

    return interaction.reply({
      content: 'I could not give you the role. Please contact a staff member.',
      flags: MessageFlags.Ephemeral,
    });
  }

  user.redeemed = true;
  saveStore();

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle('Reward redeemed')
        .setDescription(
          'You now have the **Embed Perms** role. You can send GIFs, embeds and files.'
        ),
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Trade                                                               */
/* ------------------------------------------------------------------ */

async function handleTrade(interaction) {
  const target = interaction.options.getUser('member');
  const give = interaction.options.getString('give');
  const get = interaction.options.getString('get');

  const me = getUser(interaction.user.id);
  const them = getUser(target.id);

  const giveC = BY_ID.get(give);
  const getC = BY_ID.get(get);

  if (target.bot) return ephemeral(interaction, 'You cannot trade with a bot.');
  if (target.id === interaction.user.id) return ephemeral(interaction, 'You cannot trade with yourself.');

  if (!giveC || me.countries[give] === undefined) {
    return ephemeral(interaction, 'You do not own the country you are offering.');
  }

  if (!getC || them.countries[get] === undefined) {
    return ephemeral(interaction, `${target.username} does not own that country.`);
  }

  if (them.countries[give] !== undefined) {
    return ephemeral(interaction, `${target.username} already owns **${giveC.name}**.`);
  }

  if (me.countries[get] !== undefined) {
    return ephemeral(interaction, `You already own **${getC.name}**.`);
  }

  return createRequest(interaction, {
    kind: 'trade',
    targetId: target.id,
    data: { give, get },
    title: 'Trade offer',
    description:
      `<@${interaction.user.id}> is offering you a trade:\n\n` +
      `**They give:** ${giveC.emoji} ${giveC.name} (mastery ${me.countries[give]})\n` +
      `**You give:** ${getC.emoji} ${getC.name} (mastery ${them.countries[get]})\n\n` +
      `*Mastery for traded countries resets to 0.*`,
  });
}

/* ------------------------------------------------------------------ */
/* War                                                                 */
/* ------------------------------------------------------------------ */

function warPower(user, country, mastery, extra = 0) {
  const base = mastery + (country.trade + country.sociable) / 10;
  const allyBonus = Math.min(10, user.allies.length * 2);

  const faction = userFaction(user);
  const factionBonus = faction ? Math.min(10, faction.members.length - 1) : 0;

  const roll = Math.random() * 20;

  return {
    total: base + allyBonus + factionBonus + extra + roll,
    allyBonus,
    factionBonus,
  };
}

async function handleWar(interaction) {
  const target = interaction.options.getUser('member');
  const myId = interaction.options.getString('your_country');
  const theirId = interaction.options.getString('target_country');

  const me = getUser(interaction.user.id);
  const them = getUser(target.id);

  const myC = BY_ID.get(myId);
  const theirC = BY_ID.get(theirId);

  if (target.bot) return ephemeral(interaction, 'You cannot attack a bot.');
  if (target.id === interaction.user.id) return ephemeral(interaction, 'You cannot declare war on yourself.');

  if (me.allies.includes(target.id)) {
    return ephemeral(
      interaction,
      `${target.username} is your ally. End the alliance first with \`/ally remove\`.`
    );
  }

  if (me.faction && me.faction === them.faction) {
    return ephemeral(interaction, 'You cannot attack a member of your faction.');
  }

  if (!myC || me.countries[myId] === undefined) {
    return ephemeral(interaction, 'You do not own the country you are sending into war.');
  }

  if (!theirC || them.countries[theirId] === undefined) {
    return ephemeral(interaction, `${target.username} does not own that country.`);
  }

  if (them.countries[theirId] >= MAX_MASTERY) {
    return ephemeral(
      interaction,
      `**${theirC.name}** is mastered, so it is protected and cannot be conquered.`
    );
  }

  const now = Date.now();
  const wait = me.lastWar + WAR_COOLDOWN_MS - now;

  if (wait > 0) {
    return ephemeral(
      interaction,
      `Your armies are resting. You can declare war again <t:${Math.ceil((now + wait) / 1000)}:R>.`
    );
  }

  me.lastWar = now;

  const atk = warPower(me, myC, me.countries[myId]);
  const def = warPower(them, theirC, them.countries[theirId], WAR_DEFENDER_BONUS);

  const won = atk.total > def.total;

  let outcome;

  if (won) {
    delete them.countries[theirId];

    if (me.countries[theirId] !== undefined) {
      me.countries[theirId] = Math.min(
        MAX_MASTERY,
        me.countries[theirId] + DUPLICATE_BONUS
      );

      outcome = `**${theirC.name}** has fallen, but you already own it: **+${DUPLICATE_BONUS} mastery** for your copy.`;
    } else {
      me.countries[theirId] = 0;
      outcome = `**${theirC.name}** has joined your collection (mastery 0).`;
    }

    me.wins += 1;
    them.losses += 1;
  } else {
    me.countries[myId] = Math.max(
      0,
      me.countries[myId] - WAR_LOSS_PENALTY
    );

    outcome = `Defeat! **${myC.name}** loses **${WAR_LOSS_PENALTY}** mastery (now ${me.countries[myId]}/${MAX_MASTERY}).`;

    me.losses += 1;
    them.wins += 1;
  }

  saveStore();

  const describe = (p) =>
    `Power: **${Math.round(p.total)}**` +
    (p.allyBonus ? ` (allies +${p.allyBonus}` : ' (') +
    (p.factionBonus ? `${p.allyBonus ? ', ' : ''}faction +${p.factionBonus}` : '') +
    ')';

  return interaction.reply({
    content: `<@${target.id}>`,
    allowedMentions: { users: [target.id] },
    embeds: [
      new EmbedBuilder()
        .setColor(won ? 0x57f287 : 0xed4245)
        .setTitle(`${myC.emoji} ${myC.name} vs. ${theirC.emoji} ${theirC.name}`)
        .setDescription(
          `<@${interaction.user.id}> attacks <@${target.id}>!\n\n` +
            `**Attacker** (${myC.name}): ${describe(atk).replace('()', '')}\n` +
            `**Defender** (${theirC.name}): ${describe(def).replace('()', '')}\n\n` +
            `${won ? '**Attacker wins!**' : '**The defender holds!**'}\n${outcome}`
        ),
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Allies                                                              */
/* ------------------------------------------------------------------ */

async function handleAlly(interaction) {
  const sub = interaction.options.getSubcommand();
  const target = interaction.options.getUser('member');
  const me = getUser(interaction.user.id);

  if (sub === 'list') {
    const user = target ? getUser(target.id) : me;

    const allies = user.allies
      .map((id) => `<@${id}>`)
      .join('\n');

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Allies of ${target ? target.username : interaction.user.username}`)
          .setDescription(allies || 'No allies yet.'),
      ],
    });
  }

  if (!target) {
    return ephemeral(interaction, 'Please select a member.');
  }

  if (target.bot) {
    return ephemeral(interaction, 'You cannot form an alliance with a bot.');
  }

  if (target.id === interaction.user.id) {
    return ephemeral(interaction, 'You cannot form an alliance with yourself.');
  }

  const them = getUser(target.id);

  if (sub === 'add') {
    if (me.allies.includes(target.id)) {
      return ephemeral(interaction, 'You are already allies.');
    }

    if (me.allies.length >= MAX_ALLIES || them.allies.length >= MAX_ALLIES) {
      return ephemeral(interaction, `The maximum number of allies is ${MAX_ALLIES}.`);
    }

    return createRequest(interaction, {
      kind: 'ally',
      targetId: target.id,
      data: {},
      title: 'Alliance offer',
      description: `<@${interaction.user.id}> wants to form an alliance with you.`,
    });
  }

  if (sub === 'remove') {
    if (!me.allies.includes(target.id)) {
      return ephemeral(interaction, 'You are not allies with that member.');
    }

    me.allies = me.allies.filter((id) => id !== target.id);
    them.allies = them.allies.filter((id) => id !== interaction.user.id);

    saveStore();

    return interaction.reply({
      content: `Your alliance with ${target.username} has ended.`,
    });
  }}

/* ------------------------------------------------------------------ */
/* Factions                                                            */
/* ------------------------------------------------------------------ */

function newFactionId() {
  return `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function factionEmbed(faction) {
  const ranking = Object.values(store.factions).sort(
    (a, b) => factionPower(b) - factionPower(a)
  );

  const rank = ranking.findIndex((f) => f.id === faction.id) + 1;

  const members = faction.members
    .map((id) => `${id === faction.ownerId ? '👑' : '•'} <@${id}>`)
    .join('\n');

  const mastered = faction.members.reduce(
    (sum, id) => sum + masteredCount(getUser(id)),
    0
  );

  const total = faction.members.reduce(
    (sum, id) => sum + Object.keys(getUser(id).countries).length,
    0
  );

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`🚩 ${faction.name}`)
    .setDescription(
      `**Rank:** #${rank}\n` +
        `**Power:** ${factionPower(faction)}\n` +
        `**Countries:** ${total} (${mastered} mastered)\n` +
        `**Members:** ${faction.members.length}/${MAX_FACTION_MEMBERS}\n\n${members}`
    );
}

function disbandFaction(faction) {
  for (const id of faction.members) {
    const user = getUser(id);
    if (user.faction === faction.id) user.faction = null;
  }

  delete store.factions[faction.id];
}

async function handleFaction(interaction) {
  const sub = interaction.options.getSubcommand();
  const me = getUser(interaction.user.id);
  const faction = userFaction(me);

  if (me.faction && !faction) {
    me.faction = null; // Clean up references to deleted factions
  }

  if (sub === 'create') {
    if (faction) {
      return ephemeral(
        interaction,
        `You are already in the **${faction.name}** faction.`
      );
    }

    const name = interaction.options.getString('name').trim();

    if (name.length < 3 || /[@<>`*_~|]/.test(name)) {
      return ephemeral(
        interaction,
        'Invalid name. Use 3–20 characters without special symbols.'
      );
    }

    if (
      Object.values(store.factions).some(
        (f) => f.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      return ephemeral(interaction, 'That faction name is already taken.');
    }

    const created = {
      id: newFactionId(),
      name,
      ownerId: interaction.user.id,
      members: [interaction.user.id],
      createdAt: Date.now(),
    };

    store.factions[created.id] = created;
    me.faction = created.id;

    saveStore();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe67e22)
          .setTitle('Faction created')
          .setDescription(
            `Faction **${name}** has been created! Invite members with \`/faction invite\`.`
          ),
      ],
    });
  }

  if (sub === 'info') {
    const target = interaction.options.getUser('member');
    const selectedFaction = target
      ? userFaction(getUser(target.id))
      : faction;

    if (!selectedFaction) {
      return ephemeral(
        interaction,
        target
          ? `${target.username} is not in a faction.`
          : 'You are not in a faction.'
      );
    }

    return interaction.reply({
      embeds: [factionEmbed(selectedFaction)],
      allowedMentions: { parse: [] },
    });
  }

  if (!faction) {
    return ephemeral(interaction, 'You are not in a faction.');
  }

  const isOwner = faction.ownerId === interaction.user.id;

  if (sub === 'invite') {
    const target = interaction.options.getUser('member');

    if (!isOwner) {
      return ephemeral(
        interaction,
        'Only the faction leader can invite members.'
      );
    }

    if (target.bot) {
      return ephemeral(interaction, 'You cannot invite a bot.');
    }

    if (getUser(target.id).faction) {
      return ephemeral(
        interaction,
        `${target.username} is already in a faction.`
      );
    }

    if (faction.members.length >= MAX_FACTION_MEMBERS) {
      return ephemeral(
        interaction,
        `Your faction is full (${MAX_FACTION_MEMBERS} members maximum).`
      );
    }

    return createRequest(interaction, {
      kind: 'faction',
      targetId: target.id,
      data: { factionId: faction.id },
      title: 'Faction invitation',
      description:
        `<@${interaction.user.id}> invited you to join **${faction.name}** ` +
        `(${faction.members.length}/${MAX_FACTION_MEMBERS} members).`,
    });
  }

  if (sub === 'kick') {
    const target = interaction.options.getUser('member');

    if (!isOwner) {
      return ephemeral(
        interaction,
        'Only the faction leader can remove members.'
      );
    }

    if (target.id === interaction.user.id) {
      return ephemeral(
        interaction,
        'Use `/faction disband` to disband your faction.'
      );
    }

    if (!faction.members.includes(target.id)) {
      return ephemeral(
        interaction,
        `${target.username} is not in your faction.`
      );
    }

    faction.members = faction.members.filter((id) => id !== target.id);
    getUser(target.id).faction = null;

    saveStore();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Member removed')
          .setDescription(
            `<@${target.id}> has been removed from **${faction.name}**.`
          ),
      ],
      allowedMentions: { parse: [] },
    });
  }

  if (sub === 'disband') {
    if (!isOwner) {
      return ephemeral(
        interaction,
        'Only the faction leader can disband it.'
      );
    }

    const name = faction.name;

    disbandFaction(faction);
    saveStore();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Faction disbanded')
          .setDescription(`Faction **${name}** no longer exists.`),
      ],
    });
  }

  if (sub === 'leave') {
    faction.members = faction.members.filter(
      (id) => id !== interaction.user.id
    );

    me.faction = null;

    let text = `<@${interaction.user.id}> left **${faction.name}**.`;

    if (!faction.members.length) {
      delete store.factions[faction.id];
      text += '\nThe faction is empty, so it has been disbanded.';
    } else if (isOwner) {
      faction.ownerId = faction.members[0];
      text += `\n<@${faction.ownerId}> is the new leader.`;
    }

    saveStore();

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle('Left faction')
          .setDescription(text),
      ],
      allowedMentions: { parse: [] },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Leaderboards                                                        */
/* ------------------------------------------------------------------ */

async function handleLeaderboard(interaction) {
  const type = interaction.options.getString('type') || 'players';

  let title;
  let text;

  if (type === 'factions') {
    title = 'Top Factions';

    const rows = Object.values(store.factions)
      .map((f) => ({ f, power: factionPower(f) }))
      .sort((a, b) => b.power - a.power)
      .slice(0, 10);

    text = rows.length
      ? rows
          .map(
            (r, i) =>
              `**${i + 1}.** 🚩 **${r.f.name}** — ${r.power} power, ` +
              `${r.f.members.length} members (leader: <@${r.f.ownerId}>)`
          )
          .join('\n')
      : 'No factions yet.';
  } else if (type === 'allies') {
    title = 'Top Allies';

    const rows = Object.entries(store.users)
      .map(([id, user]) => ({
        id,
        allies: Array.isArray(user.allies) ? user.allies.length : 0,
      }))
      .filter((r) => r.allies > 0)
      .sort((a, b) => b.allies - a.allies)
      .slice(0, 10);

    text = rows.length
      ? rows
          .map((r, i) => `**${i + 1}.** <@${r.id}> — ${r.allies} allies`)
          .join('\n')
      : 'No one has any allies yet.';
  } else {
    title = 'Top Collectors';

    const rows = Object.entries(store.users)
      .map(([id, user]) => ({
        id,
        mastered: masteredCount(user),
        total: Object.keys(user.countries || {}).length,
      }))
      .filter((r) => r.total > 0)
      .sort(
        (a, b) =>
          b.mastered - a.mastered || b.total - a.total
      )
      .slice(0, 10);

    text = rows.length
      ? rows
          .map(
            (r, i) =>
              `**${i + 1}.** <@${r.id}> — ${r.mastered} mastered, ${r.total} countries`
          )
          .join('\n')
      : 'Nobody owns a country yet.';
  }

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(title)
        .setDescription(text),
    ],
    allowedMentions: { parse: [] },
  });
}

/* ------------------------------------------------------------------ */
/* Autocomplete                                                        */
/* ------------------------------------------------------------------ */

function countryChoices(user, query, { skipMastered = false } = {}) {
  if (!user) return [];

  return Object.entries(user.countries)
    .map(([id, mastery]) => ({
      country: BY_ID.get(id),
      mastery,
    }))
    .filter(
      (entry) =>
        entry.country &&
        (!skipMastered || entry.mastery < MAX_MASTERY) &&
        entry.country.name.toLowerCase().includes(query)
    )
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 25)
    .map((entry) => ({
      name: `${entry.country.emoji} ${entry.country.name} (${entry.mastery}/${MAX_MASTERY})`.slice(
        0,
        100
      ),
      value: entry.country.id,
    }));
}

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused(true);
  const query = String(focused.value).toLowerCase();

  const own = getUser(interaction.user.id);
  const targetId = interaction.options.get('member')?.value;

  let choices = [];

  switch (interaction.commandName) {
    case 'farm':
      choices = countryChoices(own, query, { skipMastered: true });
      break;

    case 'trade':
      choices =
        focused.name === 'give'
          ? countryChoices(own, query)
          : countryChoices(peekUser(targetId), query);
      break;

    case 'war':
      choices =
        focused.name === 'your_country'
          ? countryChoices(own, query)
          : countryChoices(peekUser(targetId), query, {
              skipMastered: true,
            });
      break;

    default:
      break;
  }

  return interaction.respond(choices).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function init(client, { dataDir }) {
  dataFile = path.join(dataDir, 'countries.json');

  loadStore();
  grantStarters();

  client.once('clientReady', async () => {
    await registerCommands(client);

    spawn(client);

    setInterval(() => spawn(client), SPAWN_INTERVAL_MS);
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      // All game commands and buttons only work in the designated game channel.
      const isGameInteraction =
        (
          (interaction.isChatInputCommand() || interaction.isAutocomplete()) &&
          GAME_COMMANDS.has(interaction.commandName)
        ) ||
        (
          interaction.isButton() &&
          (
            interaction.customId.startsWith('claim:') ||
            interaction.customId.startsWith('req:')
          )
        );

      if (
        isGameInteraction &&
        interaction.channelId !== COUNTRY_CHANNEL_ID
      ) {
        if (interaction.isAutocomplete()) {
          return await interaction.respond([]).catch(() => {});
        }

        return await interaction.reply({
          content: `This game only works in <#${COUNTRY_CHANNEL_ID}>.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.isAutocomplete()) {
        return await handleAutocomplete(interaction);
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith('claim:')
      ) {
        return await handleClaim(interaction);
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith('req:')
      ) {
        return await handleRequestButton(interaction);
      }

      if (
        !interaction.isChatInputCommand() ||
        !interaction.guild
      ) {
        return;
      }

      switch (interaction.commandName) {
        case 'collection':
          return await handleCollection(interaction);

        case 'farm':
          return await handleFarm(interaction);

        case 'redeem':
          return await handleRedeem(interaction);

        case 'leaderboard':
          return await handleLeaderboard(interaction);

        case 'trade':
          return await handleTrade(interaction);

        case 'war':
          return await handleWar(interaction);

        case 'ally':
          return await handleAlly(interaction);

        case 'faction':
          return await handleFaction(interaction);

        default:
          return;
      }
    } catch (error) {
      console.error('[countries] Interaction error:', error);

      if (
        interaction.isRepliable &&
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        interaction
          .reply({
            content: 'Something went wrong.',
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});
      }
    }
  });
}

module.exports = { init, COUNTRIES };
client.once('ready', () => {
    startCountrySpawnSystem();
});
