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

const SPAWN_INTERVAL_MS = (7 * 60 + 30) * 1000; // un pays toutes les 7 min 30
const FARM_COOLDOWN_MS = 60 * 1000; // 1 farm par minute
const WAR_COOLDOWN_MS = 5 * 60 * 1000; // 1 guerre toutes les 5 minutes
const REQUEST_TTL_MS = 5 * 60 * 1000; // les demandes (trade, allie, invitation) expirent apres 5 min
const MAX_MASTERY = 50;
const MASTERED_NEEDED = 3; // pays a mastery 50 necessaires pour /redeem
const DUPLICATE_BONUS = 5; // mastery gagnee quand tu claim un pays que tu as deja
const MAX_ALLIES = 10;
const MAX_FACTION_MEMBERS = 15;
const WAR_LOSS_PENALTY = 3; // mastery perdue par ton pays quand tu perds une guerre
const WAR_DEFENDER_BONUS = 3;

// Ces membres commencent avec 2 pays deja mastered (aleatoires), une seule fois.
const STARTER_USER_IDS = ['1378390229626519573', '1289624819771510888'];
const STARTER_MASTERED_COUNT = 2;

// Le seul salon ou le jeu fonctionne (spawns, claims et commandes slash).
const COUNTRY_CHANNEL_ID = process.env.COUNTRY_CHANNEL_ID || '1565678201315790848';
const EMBED_PERMS_ROLE_ID = process.env.EMBED_PERMS_ROLE_ID; // role donne par /redeem
const GUILD_ID = process.env.GUILD_ID; // optionnel: enregistrement instantane des commandes

/* ------------------------------------------------------------------ */
/* Les 100 pays de 1750: [nom, emoji, commerce %, sociable %]          */
/* La rarete est calculee a partir de commerce + sociable.             */
/* ------------------------------------------------------------------ */

const RAW_COUNTRIES = [
  ['Kingdom of France', '🥖', 80, 85],
  ['Great Britain', '☕', 90, 70],
  ['Dutch Republic', 'Good country btw', 95, 75],
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
  ['Saxony', '💩', 50, 60],
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

// Poids de spawn par rarete (les Legendary sont les plus difficiles a voir).
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
/* Stockage persistant                                                 */
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

// Cree le joueur si besoin et complete les champs manquants (anciennes sauvegardes).
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

// Lecture seule: ne cree pas de joueur.
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

// Donne 2 pays mastered aleatoires aux membres de STARTER_USER_IDS (une seule fois chacun).
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
      .setStyle(ButtonStyle.Success)
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
/* Demandes (trade, alliance, invitation de faction)                   */
/* Une demande = un message avec Accepter / Refuser, que seule la      */
/* personne visee peut utiliser.                                       */
/* ------------------------------------------------------------------ */

const pending = new Map(); // id -> { id, kind, fromId, targetId, data, embed, message, timer }

async function createRequest(interaction, { kind, targetId, data, title, description }) {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Cette demande expire dans 5 minutes.' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`req:${id}:accept`).setLabel('Accepter').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`req:${id}:decline`).setLabel('Refuser').setStyle(ButtonStyle.Danger)
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
        embeds: [EmbedBuilder.from(embed).setColor(0x95a5a6).setFooter({ text: 'Demande expirée.' })],
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
    if (from.countries[give] === undefined) return { ok: false, text: `<@${req.fromId}> ne possède plus **${giveC.name}**.` };
    if (to.countries[get] === undefined) return { ok: false, text: `<@${req.targetId}> ne possède plus **${getC.name}**.` };
    if (to.countries[give] !== undefined) return { ok: false, text: `<@${req.targetId}> possède déjà **${giveC.name}**.` };
    if (from.countries[get] !== undefined) return { ok: false, text: `<@${req.fromId}> possède déjà **${getC.name}**.` };

    delete from.countries[give];
    delete to.countries[get];
    from.countries[get] = 0; // la mastery repart a zero apres un echange
    to.countries[give] = 0;
    saveStore();
    return {
      ok: true,
      text: `${giveC.emoji} **${giveC.name}** → <@${req.targetId}>\n${getC.emoji} **${getC.name}** → <@${req.fromId}>\n\n*La mastery des pays échangés repart à 0.*`,
    };
  },

  ally(req) {
    const a = getUser(req.fromId);
    const b = getUser(req.targetId);
    if (a.allies.includes(req.targetId)) return { ok: false, text: 'Vous êtes déjà alliés.' };
    if (a.allies.length >= MAX_ALLIES) return { ok: false, text: `<@${req.fromId}> a déjà ${MAX_ALLIES} alliés.` };
    if (b.allies.length >= MAX_ALLIES) return { ok: false, text: `<@${req.targetId}> a déjà ${MAX_ALLIES} alliés.` };
    a.allies.push(req.targetId);
    b.allies.push(req.fromId);
    saveStore();
    return { ok: true, text: `<@${req.fromId}> et <@${req.targetId}> sont maintenant **alliés**. Ils ne peuvent plus se faire la guerre et gagnent un bonus de combat.` };
  },

  faction(req) {
    const faction = store.factions[req.data.factionId];
    const target = getUser(req.targetId);
    if (!faction) return { ok: false, text: 'Cette faction n\'existe plus.' };
    if (target.faction) return { ok: false, text: `<@${req.targetId}> est déjà dans une faction.` };
    if (faction.members.length >= MAX_FACTION_MEMBERS) return { ok: false, text: `La faction **${faction.name}** est pleine.` };
    faction.members.push(req.targetId);
    target.faction = faction.id;
    saveStore();
    return { ok: true, text: `<@${req.targetId}> a rejoint la faction **${faction.name}** !` };
  },
};

async function handleRequestButton(interaction) {
  const [, id, action] = interaction.customId.split(':');
  const req = pending.get(id);
  if (!req) return ephemeral(interaction, 'Cette demande a expiré ou a déjà été traitée.');
  if (interaction.user.id !== req.targetId) return ephemeral(interaction, 'Cette demande ne te concerne pas.');

  pending.delete(id);
  clearTimeout(req.timer);

  if (action === 'decline') {
    return interaction.update({
      content: '',
      embeds: [EmbedBuilder.from(req.embed).setColor(0xed4245).setFooter({ text: `Refusé par ${interaction.user.username}.` })],
      components: [],
    });
  }

  const result = resolvers[req.kind](req);
  return interaction.update({
    content: '',
    embeds: [
      new EmbedBuilder()
        .setColor(result.ok ? 0x57f287 : 0xed4245)
        .setTitle(result.ok ? 'Accepté' : 'Impossible')
        .setDescription(result.text),
    ],
    components: [],
    allowedMentions: { parse: [] },
  });
}

/* ------------------------------------------------------------------ */
/* Commandes slash                                                     */
/* ------------------------------------------------------------------ */

const commandDefinitions = [
  new SlashCommandBuilder().setName('collection').setDescription('Show your countries and their mastery')
    .addUserOption((o) => o.setName('member').setDescription('Another member (optional)')),
  new SlashCommandBuilder().setName('farm').setDescription('Farm one of your countries to raise its mastery')
    .addStringOption((o) => o.setName('country').setDescription('The country to farm').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('redeem').setDescription(`Redeem the Embed Perms role (needs ${MASTERED_NEEDED} countries at mastery ${MAX_MASTERY})`),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Classements du serveur')
    .addStringOption((o) =>
      o.setName('type').setDescription('Quel classement ?')
        .addChoices(
          { name: 'Joueurs', value: 'players' },
          { name: 'Factions', value: 'factions' },
          { name: 'Alliés', value: 'allies' }
        )
    ),
  new SlashCommandBuilder().setName('trade').setDescription('Propose un échange de pays à un membre')
    .addUserOption((o) => o.setName('member').setDescription('Le membre avec qui échanger').setRequired(true))
    .addStringOption((o) => o.setName('give').setDescription('Le pays que tu donnes').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('get').setDescription('Le pays que tu veux en échange').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('war').setDescription('Déclare la guerre à un membre pour lui prendre un pays')
    .addUserOption((o) => o.setName('member').setDescription('Le membre à attaquer').setRequired(true))
    .addStringOption((o) => o.setName('your_country').setDescription('Ton pays qui part en guerre').setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName('target_country').setDescription('Le pays que tu veux conquérir').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('ally').setDescription('Gère tes alliances')
    .addSubcommand((s) => s.setName('add').setDescription('Propose une alliance')
      .addUserOption((o) => o.setName('member').setDescription('Le membre').setRequired(true)))
    .addSubcommand((s) => s.setName('remove').setDescription('Rompt une alliance')
      .addUserOption((o) => o.setName('member').setDescription('Le membre').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('Liste tes alliés')
      .addUserOption((o) => o.setName('member').setDescription('Un autre membre (optionnel)'))),
  new SlashCommandBuilder().setName('faction').setDescription('Gère les factions')
    .addSubcommand((s) => s.setName('create').setDescription('Crée ta faction')
      .addStringOption((o) => o.setName('name').setDescription('Nom de la faction (3 à 20 caractères)').setRequired(true).setMinLength(3).setMaxLength(20)))
    .addSubcommand((s) => s.setName('invite').setDescription('Invite un membre dans ta faction')
      .addUserOption((o) => o.setName('member').setDescription('Le membre').setRequired(true)))
    .addSubcommand((s) => s.setName('leave').setDescription('Quitte ta faction'))
    .addSubcommand((s) => s.setName('kick').setDescription('Expulse un membre de ta faction')
      .addUserOption((o) => o.setName('member').setDescription('Le membre').setRequired(true)))
    .addSubcommand((s) => s.setName('disband').setDescription('Dissout ta faction (chef uniquement)'))
    .addSubcommand((s) => s.setName('info').setDescription('Infos sur une faction')
      .addUserOption((o) => o.setName('member').setDescription('Faction de ce membre (optionnel)'))),
].map((c) => c.toJSON());

const GAME_COMMANDS = new Set(['collection', 'farm', 'redeem', 'leaderboard', 'trade', 'war', 'ally', 'faction']);

// Enregistre les commandes slash puis verifie toute la configuration et la
// rapporte dans les logs Render (et dans LOG_CHANNEL_ID si configure).
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

  // 2. Enregistrement
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

  // 3. Salon du jeu
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
    const lacking = perms ? needed.filter(([, flag]) => !perms.has(flag)).map(([name]) => name) : needed.map(([name]) => name);
    if (lacking.length === 0) {
      add(true, `Game channel #${channel.name} is reachable and the bot can post embeds there.`);
    } else {
      add(false, `In #${channel.name} the bot lacks: ${lacking.join(', ')}.`);
    }

    // 4. Role de recompense
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

  // Rapport
  const allOk = checks.every((c) => c.ok);
  console.log(`[countries] Startup check: ${allOk ? 'everything is fine' : 'PROBLEMS FOUND'}`);
  for (const c of checks) console.log(`[countries] ${c.ok ? 'OK     ' : 'PROBLEM'} ${c.text}`);

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
              .setDescription(checks.map((c) => `**${c.ok ? 'OK' : 'PROBLEM'}:** ${c.text}`).join('\n').slice(0, 4000))
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
    return interaction.reply({ content: 'Too late. Someone was faster, or the country already left.', flags: MessageFlags.Ephemeral });
  }

  // Ferme le spawn de facon synchrone pour qu'un seul membre puisse le gagner.
  current.claimed = true;
  const country = current.country;
  const user = getUser(interaction.user.id);
  const owned = user.countries[country.id] !== undefined;

  if (owned) {
    user.countries[country.id] = Math.min(MAX_MASTERY, user.countries[country.id] + DUPLICATE_BONUS);
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
      embeds: [new EmbedBuilder().setColor(0x2b2d31).setTitle('Collection').setDescription(`${target.username} has no country yet.`)],
    });
  }

  const shown = entries.slice(0, 25).map(
    ({ country, mastery }) =>
      `${country.emoji} **${country.name}** [${bar(mastery)}] ${mastery}/${MAX_MASTERY}${mastery >= MAX_MASTERY ? ' (MASTERED)' : ''}`
  );
  const more = entries.length > 25 ? `\n...and ${entries.length - 25} more.` : '';
  const faction = userFaction(user);

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Collection of ${target.username}`)
        .setDescription(
          `**Countries:** ${entries.length}/${COUNTRIES.length}\n` +
            `**Mastered:** ${masteredCount(user)}/${MASTERED_NEEDED} needed for Embed Perms\n` +
            `**Faction:** ${faction ? faction.name : 'aucune'}\n` +
            `**Alliés:** ${user.allies.length}/${MAX_ALLIES}\n` +
            `**Guerres:** ${user.wins} victoires / ${user.losses} défaites\n\n${shown.join('\n')}${more}`
        ),
    ],
  });
}

async function handleFarm(interaction) {
  const user = getUser(interaction.user.id);
  const countryId = interaction.options.getString('country');
  const country = BY_ID.get(countryId);

  if (!country || user.countries[countryId] === undefined) {
    return interaction.reply({ content: 'You do not own that country.', flags: MessageFlags.Ephemeral });
  }
  if (user.countries[countryId] >= MAX_MASTERY) {
    return interaction.reply({ content: `**${country.name}** is already at mastery ${MAX_MASTERY}.`, flags: MessageFlags.Ephemeral });
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

  // Trade % = chance de double recolte. Sociable % = chance de diplomatie,
  // qui augmente aussi un autre pays que tu possedes.
  let gain = 1;
  const notes = [];
  if (Math.random() * 100 < country.trade) {
    gain += 1;
    notes.push('Trade caravans doubled the harvest (+1).');
  }
  user.countries[countryId] = Math.min(MAX_MASTERY, user.countries[countryId] + gain);

  if (Math.random() * 100 < country.sociable) {
    const others = Object.keys(user.countries).filter((id) => id !== countryId && user.countries[id] < MAX_MASTERY);
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
            (mastered ? `\n\n**${country.name} is now MASTERED!** (${masteredCount(user)}/${MASTERED_NEEDED})` : '')
        ),
    ],
  });
}

async function handleRedeem(interaction) {
  const user = getUser(interaction.user.id);
  const mastered = masteredCount(user);

  if (!EMBED_PERMS_ROLE_ID) {
    return interaction.reply({ content: 'The reward role is not configured yet.', flags: MessageFlags.Ephemeral });
  }
  if (mastered < MASTERED_NEEDED) {
    return interaction.reply({
      content: `You need **${MASTERED_NEEDED}** countries at mastery ${MAX_MASTERY}. You have **${mastered}**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return interaction.reply({ content: 'Could not find you in this server.', flags: MessageFlags.Ephemeral });
  if (member.roles.cache.has(EMBED_PERMS_ROLE_ID)) {
    return interaction.reply({ content: 'You already have the Embed Perms role.', flags: MessageFlags.Ephemeral });
  }

  try {
    await member.roles.add(EMBED_PERMS_ROLE_ID, 'Redeemed with 3 mastered countries');
  } catch (error) {
    console.error('[countries] Could not give the role:', error.message);
    return interaction.reply({ content: 'I could not give you the role. Please contact a staff member.', flags: MessageFlags.Ephemeral });
  }
  user.redeemed = true;
  saveStore();

  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle('Reward redeemed').setDescription('You now have the **Embed Perms** role. You can send GIFs, embeds and files.')],
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

  if (target.bot) return ephemeral(interaction, 'Tu ne peux pas échanger avec un bot.');
  if (target.id === interaction.user.id) return ephemeral(interaction, 'Tu ne peux pas échanger avec toi-même.');
  if (!giveC || me.countries[give] === undefined) return ephemeral(interaction, 'Tu ne possèdes pas le pays que tu proposes.');
  if (!getC || them.countries[get] === undefined) return ephemeral(interaction, `${target.username} ne possède pas ce pays.`);
  if (them.countries[give] !== undefined) return ephemeral(interaction, `${target.username} possède déjà **${giveC.name}**.`);
  if (me.countries[get] !== undefined) return ephemeral(interaction, `Tu possèdes déjà **${getC.name}**.`);

  return createRequest(interaction, {
    kind: 'trade',
    targetId: target.id,
    data: { give, get },
    title: '🤝 Proposition d\'échange',
    description:
      `<@${interaction.user.id}> te propose :\n\n` +
      `**Il donne :** ${giveC.emoji} ${giveC.name} (mastery ${me.countries[give]})\n` +
      `**Tu donnes :** ${getC.emoji} ${getC.name} (mastery ${them.countries[get]})\n\n` +
      `*La mastery des pays échangés repart à 0.*`,
  });
}

/* ------------------------------------------------------------------ */
/* Guerre                                                              */
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

  if (target.bot) return ephemeral(interaction, 'Tu ne peux pas attaquer un bot.');
  if (target.id === interaction.user.id) return ephemeral(interaction, 'Tu ne peux pas te faire la guerre à toi-même.');
  if (me.allies.includes(target.id)) return ephemeral(interaction, `${target.username} est ton allié. Rompt l'alliance avec \`/ally remove\` d'abord.`);
  if (me.faction && me.faction === them.faction) return ephemeral(interaction, 'Tu ne peux pas attaquer un membre de ta faction.');
  if (!myC || me.countries[myId] === undefined) return ephemeral(interaction, 'Tu ne possèdes pas le pays que tu envoies en guerre.');
  if (!theirC || them.countries[theirId] === undefined) return ephemeral(interaction, `${target.username} ne possède pas ce pays.`);
  if (them.countries[theirId] >= MAX_MASTERY) return ephemeral(interaction, `**${theirC.name}** est mastered : il est protégé et ne peut pas être conquis.`);

  const now = Date.now();
  const wait = me.lastWar + WAR_COOLDOWN_MS - now;
  if (wait > 0) return ephemeral(interaction, `Tes armées se reposent. Prochaine guerre <t:${Math.ceil((now + wait) / 1000)}:R>.`);
  me.lastWar = now;

  const atk = warPower(me, myC, me.countries[myId]);
  const def = warPower(them, theirC, them.countries[theirId], WAR_DEFENDER_BONUS);
  const won = atk.total > def.total;

  let outcome;
  if (won) {
    delete them.countries[theirId];
    if (me.countries[theirId] !== undefined) {
      me.countries[theirId] = Math.min(MAX_MASTERY, me.countries[theirId] + DUPLICATE_BONUS);
      outcome = `**${theirC.name}** est tombé, mais tu le possédais déjà : **+${DUPLICATE_BONUS} mastery** sur ton exemplaire.`;
    } else {
      me.countries[theirId] = 0;
      outcome = `**${theirC.name}** rejoint ta collection (mastery 0).`;
    }
    me.wins += 1;
    them.losses += 1;
  } else {
    me.countries[myId] = Math.max(0, me.countries[myId] - WAR_LOSS_PENALTY);
    outcome = `Défaite ! **${myC.name}** perd **${WAR_LOSS_PENALTY}** mastery (maintenant ${me.countries[myId]}/${MAX_MASTERY}).`;
    me.losses += 1;
    them.wins += 1;
  }
  saveStore();

  const describe = (p) =>
    `Puissance : **${Math.round(p.total)}**` +
    (p.allyBonus ? ` (alliés +${p.allyBonus}` : ' (') +
    (p.factionBonus ? `${p.allyBonus ? ', ' : ''}faction +${p.factionBonus}` : '') +
    ')';

  return interaction.reply({
    content: `<@${target.id}>`,
    allowedMentions: { users: [target.id] },
    embeds: [
      new EmbedBuilder()
        .setColor(won ? 0x57f287 : 0xed4245)
        .setTitle(`⚔️ ${myC.emoji} ${myC.name} contre ${theirC.emoji} ${theirC.name}`)
        .setDescription(
          `<@${interaction.user.id}> attaque <@${target.id}> !\n\n` +
            `**Attaquant** (${myC.name}) : ${describe(atk).replace('()', '')}\n` +
            `**Défenseur** (${theirC.name}) : ${describe(def).replace('()', '')}\n\n` +
            `${won ? '🏆 **Victoire de l\'attaquant !**' : '🛡️ **Le défenseur tient bon !**'}\n${outcome}`
        ),
    ],
  });
}

/* ------------------------------------------------------------------ */
/* Allies                                                              */
/* ------------------------------------------------------------------ */

async function handleAlly(interaction) {
  const sub = interaction.options.getSubcommand();
  const me = getUser(interaction.user.id);

  if (sub === 'list') {
    const target = interaction.options.getUser('member') || interaction.user;
    const user = getUser(target.id);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`Alliés de ${target.username} (${user.allies.length}/${MAX_ALLIES})`)
          .setDescription(user.allies.length ? user.allies.map((id) => `• <@${id}>`).join('\n') : 'Aucun allié.'),
      ],
      allowedMentions: { parse: [] },
    });
  }

  const target = interaction.options.getUser('member');
  if (target.bot) return ephemeral(interaction, 'Tu ne peux pas t\'allier avec un bot.');
  if (target.id === interaction.user.id) return ephemeral(interaction, 'Tu ne peux pas t\'allier avec toi-même.');

  if (sub === 'remove') {
    if (!me.allies.includes(target.id)) return ephemeral(interaction, `${target.username} n'est pas ton allié.`);
    const other = getUser(target.id);
    me.allies = me.allies.filter((id) => id !== target.id);
    other.allies = other.allies.filter((id) => id !== interaction.user.id);
    saveStore();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Alliance rompue').setDescription(`<@${interaction.user.id}> a rompu son alliance avec <@${target.id}>.`)],
      allowedMentions: { parse: [] },
    });
  }

  // sub === 'add'
  if (me.allies.includes(target.id)) return ephemeral(interaction, `Tu es déjà allié avec ${target.username}.`);
  if (me.allies.length >= MAX_ALLIES) return ephemeral(interaction, `Tu as déjà ${MAX_ALLIES} alliés.`);
  if (getUser(target.id).allies.length >= MAX_ALLIES) return ephemeral(interaction, `${target.username} a déjà ${MAX_ALLIES} alliés.`);

  return createRequest(interaction, {
    kind: 'ally',
    targetId: target.id,
    data: {},
    title: '🕊️ Proposition d\'alliance',
    description:
      `<@${interaction.user.id}> te propose une **alliance**.\n\n` +
      `Les alliés ne peuvent pas se faire la guerre et chacun gagne un bonus de puissance en combat (+2 par allié, max +10).`,
  });
}

/* ------------------------------------------------------------------ */
/* Factions                                                            */
/* ------------------------------------------------------------------ */

function newFactionId() {
  return `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function factionEmbed(faction) {
  const ranking = Object.values(store.factions).sort((a, b) => factionPower(b) - factionPower(a));
  const rank = ranking.findIndex((f) => f.id === faction.id) + 1;
  const members = faction.members.map((id) => `${id === faction.ownerId ? '👑' : '•'} <@${id}>`).join('\n');
  const mastered = faction.members.reduce((s, id) => s + masteredCount(getUser(id)), 0);
  const total = faction.members.reduce((s, id) => s + Object.keys(getUser(id).countries).length, 0);
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`🚩 ${faction.name}`)
    .setDescription(
      `**Rang :** #${rank}\n` +
        `**Puissance :** ${factionPower(faction)}\n` +
        `**Pays :** ${total} (dont ${mastered} mastered)\n` +
        `**Membres :** ${faction.members.length}/${MAX_FACTION_MEMBERS}\n\n${members}`
    );
}

function disbandFaction(faction) {
  for (const id of faction.members) {
    const u = getUser(id);
    if (u.faction === faction.id) u.faction = null;
  }
  delete store.factions[faction.id];
}

async function handleFaction(interaction) {
  const sub = interaction.options.getSubcommand();
  const me = getUser(interaction.user.id);
  const faction = userFaction(me);

  if (me.faction && !faction) me.faction = null; // faction fantome

  if (sub === 'create') {
    if (faction) return ephemeral(interaction, `Tu es déjà dans la faction **${faction.name}**.`);
    const name = interaction.options.getString('name').trim();
    if (name.length < 3 || /[@<>`*_~|]/.test(name)) return ephemeral(interaction, 'Nom invalide (3 à 20 caractères, sans symboles spéciaux).');
    if (Object.values(store.factions).some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      return ephemeral(interaction, 'Ce nom de faction est déjà pris.');
    }
    const created = { id: newFactionId(), name, ownerId: interaction.user.id, members: [interaction.user.id], createdAt: Date.now() };
    store.factions[created.id] = created;
    me.faction = created.id;
    saveStore();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle('Faction créée').setDescription(`La faction **${name}** est née ! Invite des membres avec \`/faction invite\`.`)],
    });
  }

  if (sub === 'info') {
    const target = interaction.options.getUser('member');
    const f = target ? userFaction(getUser(target.id)) : faction;
    if (!f) return ephemeral(interaction, target ? `${target.username} n'est dans aucune faction.` : 'Tu n\'es dans aucune faction.');
    return interaction.reply({ embeds: [factionEmbed(f)], allowedMentions: { parse: [] } });
  }

  if (!faction) return ephemeral(interaction, 'Tu n\'es dans aucune faction.');
  const isOwner = faction.ownerId === interaction.user.id;

  if (sub === 'invite') {
    const target = interaction.options.getUser('member');
    if (!isOwner) return ephemeral(interaction, 'Seul le chef de la faction peut inviter.');
    if (target.bot) return ephemeral(interaction, 'Tu ne peux pas inviter un bot.');
    if (getUser(target.id).faction) return ephemeral(interaction, `${target.username} est déjà dans une faction.`);
    if (faction.members.length >= MAX_FACTION_MEMBERS) return ephemeral(interaction, `Ta faction est pleine (${MAX_FACTION_MEMBERS}).`);
    return createRequest(interaction, {
      kind: 'faction',
      targetId: target.id,
      data: { factionId: faction.id },
      title: '🚩 Invitation de faction',
      description: `<@${interaction.user.id}> t'invite à rejoindre la faction **${faction.name}** (${faction.members.length}/${MAX_FACTION_MEMBERS} membres).`,
    });
  }

  if (sub === 'kick') {
    const target = interaction.options.getUser('member');
    if (!isOwner) return ephemeral(interaction, 'Seul le chef de la faction peut expulser.');
    if (target.id === interaction.user.id) return ephemeral(interaction, 'Utilise `/faction disband` pour dissoudre ta faction.');
    if (!faction.members.includes(target.id)) return ephemeral(interaction, `${target.username} n'est pas dans ta faction.`);
    faction.members = faction.members.filter((id) => id !== target.id);
    getUser(target.id).faction = null;
    saveStore();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Membre expulsé').setDescription(`<@${target.id}> a été expulsé de **${faction.name}**.`)],
      allowedMentions: { parse: [] },
    });
  }

  if (sub === 'disband') {
    if (!isOwner) return ephemeral(interaction, 'Seul le chef de la faction peut la dissoudre.');
    const name = faction.name;
    disbandFaction(faction);
    saveStore();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Faction dissoute').setDescription(`La faction **${name}** n'existe plus.`)],
    });
  }

  if (sub === 'leave') {
    faction.members = faction.members.filter((id) => id !== interaction.user.id);
    me.faction = null;
    let text = `<@${interaction.user.id}> a quitté **${faction.name}**.`;
    if (!faction.members.length) {
      delete store.factions[faction.id];
      text += '\nLa faction est vide et a été dissoute.';
    } else if (isOwner) {
      faction.ownerId = faction.members[0];
      text += `\n<@${faction.ownerId}> devient le nouveau chef.`;
    }
    saveStore();
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x95a5a6).setTitle('Faction quittée').setDescription(text)],
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
      ? rows.map((r, i) => `**${i + 1}.** 🚩 **${r.f.name}** - ${r.power} puissance, ${r.f.members.length} membres (chef <@${r.f.ownerId}>)`).join('\n')
      : 'Aucune faction pour le moment.';
  } else if (type === 'allies') {
    title = 'Top Alliés';
    const rows = Object.entries(store.users)
      .map(([id, u]) => ({ id, allies: Array.isArray(u.allies) ? u.allies.length : 0 }))
      .filter((r) => r.allies > 0)
      .sort((a, b) => b.allies - a.allies)
      .slice(0, 10);
    text = rows.length
      ? rows.map((r, i) => `**${i + 1}.** <@${r.id}> - ${r.allies} allié${r.allies > 1 ? 's' : ''}`).join('\n')
      : 'Personne n\'a encore d\'allié.';
  } else {
    title = 'Top Collectors';
    const rows = Object.entries(store.users)
      .map(([id, u]) => ({ id, mastered: masteredCount(u), total: Object.keys(u.countries || {}).length }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.mastered - a.mastered || b.total - a.total)
      .slice(0, 10);
    text = rows.length
      ? rows.map((r, i) => `**${i + 1}.** <@${r.id}> - ${r.mastered} mastered, ${r.total} countries`).join('\n')
      : 'Nobody owns a country yet.';
  }

  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(title).setDescription(text)],
    allowedMentions: { parse: [] },
  });
}

/* ------------------------------------------------------------------ */
/* Autocomplete                                                        */
/* ------------------------------------------------------------------ */

function countryChoices(user, query, { skipMastered = false } = {}) {
  if (!user) return [];
  return Object.entries(user.countries)
    .map(([id, mastery]) => ({ country: BY_ID.get(id), mastery }))
    .filter((e) => e.country && (!skipMastered || e.mastery < MAX_MASTERY) && e.country.name.toLowerCase().includes(query))
    .sort((a, b) => b.mastery - a.mastery)
    .slice(0, 25)
    .map((e) => ({ name: `${e.country.emoji} ${e.country.name} (${e.mastery}/${MAX_MASTERY})`.slice(0, 100), value: e.country.id }));
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
      choices = focused.name === 'give' ? countryChoices(own, query) : countryChoices(peekUser(targetId), query);
      break;
    case 'war':
      choices = focused.name === 'your_country' ? countryChoices(own, query) : countryChoices(peekUser(targetId), query, { skipMastered: true });
      break;
    default:
      break;
  }
  return interaction.respond(choices).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Point d'entree                                                      */
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
      // Tout le jeu ne fonctionne que dans le salon du jeu.
      const isGameInteraction =
        ((interaction.isChatInputCommand() || interaction.isAutocomplete()) && GAME_COMMANDS.has(interaction.commandName)) ||
        (interaction.isButton() && (interaction.customId.startsWith('claim:') || interaction.customId.startsWith('req:')));
      if (isGameInteraction && interaction.channelId !== COUNTRY_CHANNEL_ID) {
        if (interaction.isAutocomplete()) return await interaction.respond([]).catch(() => {});
        return await interaction.reply({
          content: `This game only works in <#${COUNTRY_CHANNEL_ID}>.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.isAutocomplete()) return await handleAutocomplete(interaction);
      if (interaction.isButton() && interaction.customId.startsWith('claim:')) return await handleClaim(interaction);
      if (interaction.isButton() && interaction.customId.startsWith('req:')) return await handleRequestButton(interaction);
      if (!interaction.isChatInputCommand() || !interaction.guild) return;

      switch (interaction.commandName) {
        case 'collection': return await handleCollection(interaction);
        case 'farm': return await handleFarm(interaction);
        case 'redeem': return await handleRedeem(interaction);
        case 'leaderboard': return await handleLeaderboard(interaction);
        case 'trade': return await handleTrade(interaction);
        case 'war': return await handleWar(interaction);
        case 'ally': return await handleAlly(interaction);
        case 'faction': return await handleFaction(interaction);
        default: return;
      }
    } catch (error) {
      console.error('[countries] Interaction error:', error);
      if (interaction.isRepliable && interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}

module.exports = { init, COUNTRIES };
