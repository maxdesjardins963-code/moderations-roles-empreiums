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

const SPAWN_INTERVAL_MS = (7 * 60 + 30) * 1000; // a country every 7 minutes 30
const FARM_COOLDOWN_MS = 60 * 1000; // 1 farm per minute
const MAX_MASTERY = 50;
const MASTERED_NEEDED = 3; // countries at mastery 50 needed to redeem
const DUPLICATE_BONUS = 5; // mastery gained when you claim a country you already own

// The only channel where the game happens (spawns, claims and slash commands).
const COUNTRY_CHANNEL_ID = process.env.COUNTRY_CHANNEL_ID || '1565678201315790848';
const EMBED_PERMS_ROLE_ID = process.env.EMBED_PERMS_ROLE_ID; // role given by /redeem
const GUILD_ID = process.env.GUILD_ID; // optional: instant slash command registration

/* ------------------------------------------------------------------ */
/* The 100 countries of 1750: [name, emoji, trade %, sociable %]       */
/* Rarity is computed from trade + sociable.                           */
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

// Spawn weights per rarity tier (Legendary countries are the hardest to see).
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
/* Persistent storage                                                  */
/* ------------------------------------------------------------------ */

let dataFile;
let store = { users: {} };

function loadStore() {
  try {
    store = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    if (!store || typeof store !== 'object' || typeof store.users !== 'object') throw new Error('Invalid format');
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('[countries] Could not read the data file.', error.message);
    store = { users: {} };
  }
}

function saveStore() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  const tmp = `${dataFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, dataFile);
}

function getUser(userId) {
  if (!store.users[userId]) store.users[userId] = { countries: {}, lastFarm: 0, redeemed: false };
  return store.users[userId];
}

function masteredCount(user) {
  return Object.values(user.countries).filter((m) => m >= MAX_MASTERY).length;
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
/* Slash commands                                                      */
/* ------------------------------------------------------------------ */

const commandDefinitions = [
  new SlashCommandBuilder().setName('collection').setDescription('Show your countries and their mastery')
    .addUserOption((o) => o.setName('member').setDescription('Another member (optional)')),
  new SlashCommandBuilder().setName('farm').setDescription('Farm one of your countries to raise its mastery')
    .addStringOption((o) => o.setName('country').setDescription('The country to farm').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('redeem').setDescription(`Redeem the Embed Perms role (needs ${MASTERED_NEEDED} countries at mastery ${MAX_MASTERY})`),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Top collectors of the server'),
].map((c) => c.toJSON());

const GAME_COMMANDS = new Set(['collection', 'farm', 'redeem', 'leaderboard']);

// Registers the slash commands, then verifies the whole setup and reports it
// in the Render logs (and in the LOG_CHANNEL_ID channel when it is configured).
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

  // 2. Registration
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
    const lacking = perms ? needed.filter(([, flag]) => !perms.has(flag)).map(([name]) => name) : needed.map(([name]) => name);
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

  // Report
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

async function handleClaim(interaction) {
  const spawnId = interaction.customId.split(':')[1];
  if (!current || current.id !== spawnId || current.claimed) {
    return interaction.reply({ content: 'Too late. Someone was faster, or the country already left.', flags: MessageFlags.Ephemeral });
  }

  // Close the spawn synchronously so only one member can ever win it.
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

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`Collection of ${target.username}`)
        .setDescription(
          `**Countries:** ${entries.length}/${COUNTRIES.length}\n` +
            `**Mastered:** ${masteredCount(user)}/${MASTERED_NEEDED} needed for Embed Perms\n\n${shown.join('\n')}${more}`
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

  // Trade % = chance of a double harvest. Sociable % = chance of diplomacy,
  // which also raises another country you own.
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

async function handleLeaderboard(interaction) {
  const rows = Object.entries(store.users)
    .map(([id, u]) => ({ id, mastered: masteredCount(u), total: Object.keys(u.countries).length }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.mastered - a.mastered || b.total - a.total)
    .slice(0, 10);

  const text = rows.length
    ? rows.map((r, i) => `**${i + 1}.** <@${r.id}> - ${r.mastered} mastered, ${r.total} countries`).join('\n')
    : 'Nobody owns a country yet.';

  return interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Top Collectors').setDescription(text)],
    allowedMentions: { parse: [] },
  });
}

async function handleAutocomplete(interaction) {
  const focused = interaction.options.getFocused().toLowerCase();
  const user = getUser(interaction.user.id);
  const choices = Object.entries(user.countries)
    .map(([id, mastery]) => ({ country: BY_ID.get(id), mastery }))
    .filter((e) => e.country && e.mastery < MAX_MASTERY && e.country.name.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((e) => ({ name: `${e.country.emoji} ${e.country.name} (${e.mastery}/${MAX_MASTERY})`.slice(0, 100), value: e.country.id }));
  return interaction.respond(choices).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

function init(client, { dataDir }) {
  dataFile = path.join(dataDir, 'countries.json');
  loadStore();

  client.once('clientReady', async () => {
    await registerCommands(client);
    spawn(client);
    setInterval(() => spawn(client), SPAWN_INTERVAL_MS);
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      // Everything about the game only works in the game channel.
      const isGameInteraction =
        ((interaction.isChatInputCommand() || interaction.isAutocomplete()) && GAME_COMMANDS.has(interaction.commandName)) ||
        (interaction.isButton() && interaction.customId.startsWith('claim:'));
      if (isGameInteraction && interaction.channelId !== COUNTRY_CHANNEL_ID) {
        if (interaction.isAutocomplete()) return await interaction.respond([]).catch(() => {});
        return await interaction.reply({
          content: `This game only works in <#${COUNTRY_CHANNEL_ID}>.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.isAutocomplete() && interaction.commandName === 'farm') return await handleAutocomplete(interaction);
      if (interaction.isButton() && interaction.customId.startsWith('claim:')) return await handleClaim(interaction);
      if (!interaction.isChatInputCommand() || !interaction.guild) return;

      switch (interaction.commandName) {
        case 'collection': return await handleCollection(interaction);
        case 'farm': return await handleFarm(interaction);
        case 'redeem': return await handleRedeem(interaction);
        case 'leaderboard': return await handleLeaderboard(interaction);
        default: return;
      }
    } catch (error) {
      console.error('[countries] Interaction error:', error.message);
      if (interaction.isRepliable && interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  });
}

module.exports = { init, COUNTRIES };
