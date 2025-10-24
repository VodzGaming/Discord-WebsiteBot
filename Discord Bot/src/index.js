import 'dotenv/config';
console.log('[boot] index.js start');
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Client, GatewayIntentBits, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField, Partials, StringSelectMenuBuilder } from 'discord.js';

// Local modules
import { setupAuth, requireLogin, userCanManageGuild } from './lib/auth.js';
import { initDb, db, getModuleStates, setModuleState, isModuleEnabled, addWebLog, getWebLogsByType, getWebLogsCountByType, backfillWebLogTypes, getWebLogsForGuild, getBotSettings, setBotSettings, getManagerRoles, setManagerRoles } from './lib/db.js';
import { initMySql, mysqlEnabled } from './lib/mysql.js';
import { commandData } from './lib/commands.js';
import { handleInteractions } from './lib/interactions.js';
import { startLiveWatchers, webhookRouter } from './live/watchers.js';
import { getReactionMenuByMessageId } from './lib/db.js';
import { musicInit, musicJoinAndPlay, musicSkip, musicQueue } from './music/player.js';

// Views
import { renderServers } from './views/servers.js';
import { renderServerListing } from './views/serverListing.js';
import { renderDashboard } from './views/dashboard.js';
import { renderWelcomeSettings } from './views/welcome.js';
import { renderModulesPage } from './views/modules.js';
import { modulesList } from './lib/modules.js';
import { renderWelcomeChannel } from './views/welcomeChannel.js';
import { renderHome } from './views/home.js';
import { renderLogs } from './views/logs.js';
import { renderCommands } from './views/commands.js';
// Roles page migrated to EJS template (src/templates/roles.ejs)
import path from 'path';
import { fileURLToPath } from 'url';
import { addReactionMenu, getReactionMenus, deleteReactionMenu, getReactionMenuById } from './lib/db.js';


// --- Discord client ---
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember]
});

await initDb();
console.log('[boot] initDb done');
// Defer MySQL initialization until after the web server is listening so startup isn't blocked

// Global process diagnostics to catch silent exits/errors
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
});
process.on('beforeExit', (code) => {
  console.log('[beforeExit] code=', code);
});
process.on('exit', (code) => {
  console.log('[exit] code=', code);
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (String(process.env.REGISTER_GLOBAL_COMMANDS || 'true').toLowerCase() === 'true') {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandData });
      console.log('Global slash commands registered.');
    } else {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID_DEV), { body: commandData });
      console.log('Dev guild slash commands registered.');
    }
  } catch (e) {
    console.error('Failed to register commands', e);
  }
});

client.on('interactionCreate', handleInteractions);
// Slash command handler for music + level
client.on('interactionCreate', async (ix) => {
  try{
    if(!('isChatInputCommand' in ix) || !ix.isChatInputCommand()) return;
    if(ix.commandName === 'play'){
      const url = ix.options.getString('url', true);
      const vc = ix.member?.voice?.channel;
      if(!vc) return ix.reply({ content:'Join a voice channel first.', ephemeral:true });
      await ix.deferReply({ ephemeral:true });
      try{ await musicJoinAndPlay({ guild: ix.guild, channelId: vc.id, url }); await ix.editReply('Queued.'); }catch(e){ await ix.editReply('Failed: ' + (e?.message||'Unknown')); }
    } else if(ix.commandName === 'skip'){
      const ok = musicSkip(ix.guild?.id);
      return ix.reply({ content: ok ? 'Skipped.' : 'Nothing playing.', ephemeral:true });
    } else if(ix.commandName === 'queue'){
      const q = musicQueue(ix.guild?.id);
      return ix.reply({ content: q.length ? q.map((x,i)=> `${i+1}. ${x.title}`).join('\n') : 'Queue is empty.', ephemeral:true });
    } else if(ix.commandName === 'level'){
      const { getLevelRow } = await import('./lib/db.js');
      const row = getLevelRow(ix.guild.id, ix.user.id);
      return ix.reply({ content: `Level ${row.level||0} — XP ${row.xp||0}`, ephemeral:true });
    }
  }catch(_){ }
});

// When the bot is added to a new guild, verify required permissions and guide admins immediately
client.on('guildCreate', async (guild) => {
  try{
    const me = guild.members?.me || await guild.members.fetchMe().catch(()=>null);
    if(!me) return;
    const hasManageRoles = me.permissions.has(PermissionsBitField.Flags.ManageRoles);
    if(hasManageRoles) return; // we're good
    // Craft a reinvite URL with Manage Roles (and bot commands) locked to this guild
    const clientId = process.env.CLIENT_ID || client?.application?.id || client?.user?.id || '';
    const scopes = 'bot%20applications.commands';
    const recommendedPerms = (
      0x00000040 + /* Add Reactions */
      0x00000400 + /* View Channel */
      0x00000800 + /* Send Messages */
      0x00004000 + /* Embed Links */
      0x00008000 + /* Attach Files */
      0x00010000 + /* Read Message History */
      0x00040000 + /* Use External Emojis */
      0x10000000   /* Manage Roles */
    );
    const inviteUrl = clientId ? `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=${recommendedPerms}&scope=${scopes}&guild_id=${encodeURIComponent(guild.id)}&disable_guild_select=true` : null;
    const adminUrl = clientId ? `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=8&scope=${scopes}&guild_id=${encodeURIComponent(guild.id)}&disable_guild_select=true` : null;
    // Pick a channel to notify (system channel preferred)
    let ch = guild.systemChannel || null;
    if(!ch){ try{ await guild.channels.fetch(); }catch(_){}
      ch = guild.channels.cache.find(c=> c && c.type===0 && c.permissionsFor(me)?.has(PermissionsBitField.Flags.SendMessages));
    }
    if(ch && 'send' in ch){
      const lines = [
        `Hi! I need the Manage Roles permission to assign reaction roles.`,
        inviteUrl ? `Fix it in one click: <${inviteUrl}>` : `Fix it by re-inviting me with Manage Roles enabled.`,
        `Alternatively, use Administrator: ${adminUrl ? `<${adminUrl}>` : '(invite with perms=8)'} `,
        `After that, drag my highest role above the roles I should assign (Server Settings → Roles).`
      ];
      try{ await ch.send(lines.join('\n')); }catch(_){ }
    }
  }catch(_){ }
});

// Reaction role handlers (emoji based)
client.on('messageReactionAdd', async (reaction, user) => {
  try{
    if(user?.bot) return;
    const message = reaction.message?.partial ? await reaction.message.fetch() : reaction.message;
    const guild = message?.guild; if(!guild) return;
    if(!isModuleEnabled(guild.id, 'roles')) return; // module disabled
    const menu = getReactionMenuByMessageId(message.id);
    if(!menu) return;
    const emo = reaction.emoji?.id ? reaction.emoji.id : reaction.emoji?.name;
    if(!emo) return;
    const entry = (menu.roles||[]).find(r=> {
      if(!r.emoji) return false;
      // Stored as ID (custom) or unicode; match accordingly
      return String(r.emoji) === String(reaction.emoji?.id || '') || String(r.emoji) === String(reaction.emoji?.name || '');
    });
  if(!entry) return;
    const member = await guild.members.fetch(user.id).catch(()=>null);
    if(!member) return;
    // allowed/ignored role enforcement
    try{
      const allowList = String(menu.allowed_roles||'').split(',').map(s=>s.trim()).filter(Boolean);
      const ignoreList = String(menu.ignored_roles||'').split(',').map(s=>s.trim()).filter(Boolean);
      if(ignoreList.length && ignoreList.some(id=> member.roles.cache.has(id))){
        try{ await reaction.users.remove(user.id).catch(()=>{}); }catch(_){ }
        return;
      }
      if(allowList.length && !allowList.some(id=> member.roles.cache.has(id))){
        try{ await reaction.users.remove(user.id).catch(()=>{}); }catch(_){ }
        return;
      }
    }catch(_){ }
    // If allow_multi is off, remove other roles from same menu first
    try{
      if(menu && !menu.allow_multi){
        const others = (menu.roles||[]).map(r=>r.role_id).filter(rid=> rid && rid !== entry.role_id && member.roles.cache.has(rid));
        if(others.length){
          try{ await member.roles.remove(others).catch(()=>{}); }catch(_){ /* ignore */ }
        }
      }
    }catch(_){ /* ignore */ }
    // Permission and hierarchy checks
    try{
      const me = guild.members.me || await guild.members.fetchMe();
      const role = guild.roles.cache.get(String(entry.role_id));
      if(!role) return;
      if(!me.permissions.has(PermissionsBitField.Flags.ManageRoles)){
        try{ addWebLog({ guild_id: guild.id, user_id: user.id, username: user.username, action: `Cannot assign @${role.name}: Missing Manage Roles permission`, action_type: 'dashboard' }); }catch(_){ }
        try{ await reaction.users.remove(user.id).catch(()=>{}); }catch(_){ }
        return;
      }
      if(role.comparePositionTo(me.roles.highest) >= 0){
        try{ addWebLog({ guild_id: guild.id, user_id: user.id, username: user.username, action: `Cannot assign @${role.name}: Role is above bot's highest role`, action_type: 'dashboard' }); }catch(_){ }
        try{ await reaction.users.remove(user.id).catch(()=>{}); }catch(_){ }
        return;
      }
    }catch(_){ }
    // reverse_mode handling: if enabled, invert add/remove behavior
    const doAdd = !menu.reverse_mode;
    const doRemove = menu.reverse_mode;
    const op = doAdd ? 'add' : 'remove';
    await member.roles[op](entry.role_id).catch(async (err)=>{
      try{ addWebLog({ guild_id: guild.id, user_id: user.id, username: user.username, action: `Reaction add failed for role ${entry.role_id}: ${err?.message||'Unknown'}`, action_type: 'dashboard' }); }catch(_){ }
    });
  }catch(e){ /* ignore */ }
});
client.on('messageReactionRemove', async (reaction, user) => {
  try{
    if(user?.bot) return;
    const message = reaction.message?.partial ? await reaction.message.fetch() : reaction.message;
    const guild = message?.guild; if(!guild) return;
    if(!isModuleEnabled(guild.id, 'roles')) return; // module disabled
    const menu = getReactionMenuByMessageId(message.id);
    if(!menu) return;
    const emo = reaction.emoji?.id ? reaction.emoji.id : reaction.emoji?.name;
    if(!emo) return;
    const entry = (menu.roles||[]).find(r=> {
      if(!r.emoji) return false;
      return String(r.emoji) === String(reaction.emoji?.id || '') || String(r.emoji) === String(reaction.emoji?.name || '');
    });
    if(!entry) return;
    const member = await guild.members.fetch(user.id).catch(()=>null);
    if(!member) return;
    // Permission and hierarchy checks (best-effort)
    try{
      const me = guild.members.me || await guild.members.fetchMe();
      const role = guild.roles.cache.get(String(entry.role_id));
      if(!role) return;
      if(!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;
      if(role.comparePositionTo(me.roles.highest) >= 0) return;
    }catch(_){ }
    // reverse_mode handling: if enabled, invert add/remove behavior
    const doAdd = menu.reverse_mode;
    const doRemove = !menu.reverse_mode;
    const op = doAdd ? 'add' : 'remove';
    await member.roles[op](entry.role_id).catch(async (err)=>{
      try{ addWebLog({ guild_id: guild.id, user_id: user.id, username: user.username, action: `Reaction remove failed for role ${entry.role_id}: ${err?.message||'Unknown'}`, action_type: 'dashboard' }); }catch(_){ }
    });
  }catch(e){ /* ignore */ }
});

// Welcome message on member join
client.on('guildMemberAdd', async (member) => {
  try{
    const guild = member.guild; if(!guild) return;
    // Load welcome settings
    const row = db.prepare('SELECT * FROM welcome_settings WHERE guild_id=?').get(guild.id);
    if(!row || !row.enabled) return;
    const channelId = row.channel_id; if(!channelId) return;
    const ch = await guild.channels.fetch(channelId).catch(()=>null);
    if(!ch || !('send' in ch)) return;

    // Placeholder replacement
    const replaceVars = (s='') => {
      try{
        return String(s)
          .replaceAll('{user}', `<@${member.id}>`)
          .replaceAll('{username}', member.user?.username || '')
          .replaceAll('{server}', guild.name || '')
          .replaceAll('{server.member_count}', String(guild.memberCount || guild.memberCount === 0 ? guild.memberCount : ''));
      }catch{ return s; }
    };

    // Build payload based on message_type
    const type = String(row.message_type || 'message');
    const message_text = replaceVars(row.message_text || '');
    let payload = {};

    const buildEmbedFromJson = (ej) => {
      const e = new EmbedBuilder();
      const trim = (x) => typeof x==='string' ? x.trim() : x;
      try{
        if (trim(ej?.title)) e.setTitle(trim(ej.title));
        if (trim(ej?.title_url)) e.setURL(trim(ej.title_url));
        if (trim(ej?.description)) e.setDescription(replaceVars(trim(ej.description)));
        if (ej?.color) {
          if (typeof ej.color === 'string') {
            let s = ej.color.trim();
            if (/^#?[0-9a-f]{6}$/i.test(s)) { s = s.replace('#',''); e.setColor(parseInt(s, 16)); }
            else if (/^0x[0-9a-f]{6}$/i.test(s)) { e.setColor(parseInt(s, 16)); }
            else if (/^[0-9]+$/.test(s)) { e.setColor(parseInt(s, 10)); }
          } else if (typeof ej.color === 'number') { e.setColor(ej.color); }
        }
        if (trim(ej?.author_name) || trim(ej?.author_icon)) e.setAuthor({ name: replaceVars(trim(ej.author_name) || ''), iconURL: trim(ej.author_icon) || undefined });
        if (trim(ej?.thumbnail)) e.setThumbnail(trim(ej.thumbnail));
        if (trim(ej?.image)) e.setImage(trim(ej.image));
        if (trim(ej?.footer_text) || trim(ej?.footer_icon)) e.setFooter({ text: replaceVars(trim(ej.footer_text) || ''), iconURL: trim(ej.footer_icon) || undefined });
        if (Array.isArray(ej?.fields)) {
          const safeFields = ej.fields.filter(f=>f && f.name && f.value).slice(0,25).map(f=>({ name:String(f.name).slice(0,256), value:replaceVars(String(f.value).slice(0,1024)), inline: !!f.inline }));
          if (safeFields.length) e.addFields(safeFields);
        }
      }catch{}
      return e;
    };

    if (type === 'message') {
      payload.content = message_text || ' ';
    } else if (type === 'embed' || type === 'embed_text') {
      let ej = null; try { ej = row.embed_json ? JSON.parse(row.embed_json) : null; } catch{}
      const embed = buildEmbedFromJson(ej || {});
      const hasEmbed = (()=>{ try{ const d = embed.data || embed.toJSON?.(); return d && Object.keys(d).length>0; }catch{ return false; } })();
      if (hasEmbed) payload.embeds = [embed];
      if (type === 'embed_text') payload.content = message_text || '';
      if (type === 'embed' && !hasEmbed) payload.content = message_text || ' ';
    } else if (type === 'custom_image') {
      // Use image URL from custom_image_json, if present
      let cfg = null; try { cfg = row.custom_image_json ? JSON.parse(row.custom_image_json) : null; } catch{}
      const imgUrl = cfg?.backgroundUrl || null;
      if (imgUrl) {
        try{
          const e = new EmbedBuilder();
          e.setImage(imgUrl);
          payload.embeds = [e];
          if (message_text) payload.content = message_text;
        }catch{}
      } else {
        payload.content = message_text || ' ';
      }
    } else {
      payload.content = message_text || ' ';
    }

    await ch.send((payload.content || (payload.embeds && payload.embeds.length) || (payload.files && payload.files.length)) ? payload : { content: ' ' });
    try{ addWebLog({ guild_id: guild.id, user_id: member.id, username: member.user?.username || 'New Member', action: `Sent welcome for ${member.user?.username||member.id}`, action_type: 'dashboard' }); }catch{}
  }catch(e){ /* ignore */ }
});

// --- Express app ---
const app = express();
console.log('[boot] express app created');
// Trust proxy config: avoid permissive 'true' which breaks express-rate-limit.
// Default to 'loopback' (safe for local dev and cloudflared which binds to 127.0.0.1).
// You can override via env TRUST_PROXY (e.g., 'uniquelocal', '127.0.0.1', or a subnet).
const TRUST_PROXY = process.env.TRUST_PROXY || 'loopback';
app.set('trust proxy', TRUST_PROXY);
// Secure headers (disable CSP here to avoid breaking inline scripts; can be tuned later)
app.use(helmet({ contentSecurityPolicy: false }));
// Mount webhooks BEFORE JSON parsing so we can capture raw bodies (Twitch EventSub verification)
app.use('/webhooks', webhookRouter);
// Increase limits to allow base64 canvas images from the banner builder
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));

// Setup EJS templating for HTML-like views
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'ejs');

// Rate limiting: generous defaults; adjust as needed
// Apply rate limits (after trust proxy is set)
const dashboardLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,            // 200 req/min per IP
  standardHeaders: true,
  legacyHeaders: false
});
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

setupAuth(app);
// Throttle typical auth endpoints to reduce abuse
app.use(['/login', '/auth', '/oauth', '/callback', '/auth/discord', '/auth/discord/callback'], authLimiter);
// (webhooks were mounted earlier)

// Root
app.get('/', (req, res) => {
  const loggedIn = !!req.session?.user;
  const username = req.session?.user?.username || '';
  return res.type('html').send(renderHome({ loggedIn, username }));
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Invite (with optional guild locking)
app.get('/invite', (req, res) => {
  const overrideId = (req.query.client_id || '').toString().trim();
  // Try runtime-derived ID from the logged-in client as a fallback
  const runtimeId = (client?.application?.id) || (client?.user?.id) || '';
  // Prefer CLIENT_ID over OAUTH_CLIENT_ID (users sometimes put perms=8 in OAUTH_CLIENT_ID by mistake)
  const envClient = process.env.CLIENT_ID || process.env.OAUTH_CLIENT_ID || '';
  const candidates = [overrideId, envClient, runtimeId].filter(Boolean);
  const isValidId = (s) => !!String(s).match(/^\d{16,25}$/);
  const clientId = candidates.find(isValidId) || '';
  const perms = (req.query.perms || '268438544').toString();
  const scopes = (req.query.scopes || 'bot%20applications.commands').toString();
  const gid = req.query.guild_id ? `&guild_id=${encodeURIComponent(req.query.guild_id)}&disable_guild_select=true` : '';
  if (!clientId) {
    return res.status(400).type('html').send(`
      <div style="font-family:system-ui,Segoe UI,Arial;padding:16px;background:#0b0f17;color:#e5e7eb">
        <h2>Invite Error</h2>
        <div>Missing or invalid client_id. Set CLIENT_ID in your .env to your Discord Application ID.</div>
        <div style="margin-top:8px"><a href="/invite?debug=1">Open Debug</a></div>
      </div>
    `);
  }
  const url = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&permissions=${encodeURIComponent(perms)}&scope=${scopes}${gid}`;
  if (String(req.query.debug||'0')==='1'){
    return res.type('html').send(`
      <div style="font-family:system-ui,Segoe UI,Arial;padding:16px;background:#0b0f17;color:#e5e7eb">
        <h2>Invite Link (debug)</h2>
        <div>Using client_id: <code>${clientId}</code></div>
        <div>From env: CLIENT_ID=<code>${process.env.CLIENT_ID||''}</code>, OAUTH_CLIENT_ID=<code>${process.env.OAUTH_CLIENT_ID||''}</code></div>
        <div>Runtime: application.id=<code>${client?.application?.id || ''}</code>, user.id=<code>${client?.user?.id || ''}</code></div>
        <div>Permissions: <code>${perms}</code></div>
        <div>Scopes: <code>${decodeURIComponent(scopes)}</code></div>
        <div style="margin-top:8px"><a href="${url}">Open Invite</a></div>
      </div>
    `);
  }
  res.redirect(url);
});

// Servers list (server-select)
// Apply dashboard limiter to dashboard-related sections
app.use(['/dashboard', '/modules', '/servers', '/logs'], dashboardLimiter);

app.get('/servers', requireLogin, (req, res) => {
  const manageable = req.session.guildsManageable || [];
  return res.type('html').send(renderServers({ user: req.session.user, manageable }));
});

// Commands placeholder
app.get('/commands', requireLogin, (req, res) => {
  return res.type('html').send(renderCommands());
});

// Modules overview page
app.get('/modules', requireLogin, async (req, res) => {
  const guildId = req.query.guild_id;
  // restore last guild if missing
  if (!guildId && req.session?.lastGuildId) {
    return res.redirect(`/modules?guild_id=${encodeURIComponent(req.session.lastGuildId)}`);
  }
  const guild = guildId ? await client.guilds.fetch(guildId).catch(()=>null) : null;
  try { if (guildId && req.session) req.session.lastGuildId = guildId; } catch(e) {}
  const moduleStates = guildId ? getModuleStates(guildId) : {};
  // Build cards from central list
  const cards = modulesList.map(m => ({
    title: m.name,
    desc: m.desc || '',
    icon: m.icon || '',
    category: m.category || '',
    settingsHref: guildId ? m.href(guildId) : '/servers',
    toggleHref: guildId ? `/dashboard/guild/${guildId}/${m.key}/toggle` : '/servers',
    enabled: !!moduleStates[m.key]
  }));
  return res.type('html').send(renderModulesPage({ guildId, guild, cards }));
});

// Roles module page (Reaction Roles)
app.get('/dashboard/guild/:guildId/roles', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const guild = await client.guilds.fetch(guildId).catch(()=>null);
  if(guild){ try{ await guild.roles.fetch(); await guild.channels.fetch(); await guild.emojis.fetch(); }catch(e){} }
  const roleList = guild ? Array.from(guild.roles.cache.values()).filter(r=>!r.managed && r.id!==guild.id).sort((a,b)=> a.position-b.position).map(r=>({ id:r.id, name:r.name })) : [];
  const textChannels = guild ? Array.from(guild.channels.cache.values()).filter(c=> c && (c.type===0 || c.type==='GUILD_TEXT')).map(c=>({ id:c.id, name:c.name })) : [];
  const emojis = guild ? Array.from(guild.emojis.cache.values()).map(e=>({ id: e.id, name: e.name || '', animated: !!e.animated, url: (typeof e.imageURL==='function' ? e.imageURL() : ''), mention: (e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`) })) : [];
  const menus = getReactionMenus(guildId);
  return res.render('roles', { guild, textChannels, roleList, menus, emojis });
});

// Dedicated Reaction Menus management page
app.get('/dashboard/guild/:guildId/roles/menus', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const guild = await client.guilds.fetch(guildId).catch(()=>null);
  if(guild){ try{ await guild.roles.fetch(); await guild.channels.fetch(); }catch(e){} }
  const textChannels = guild ? Array.from(guild.channels.cache.values()).filter(c=> c && (c.type===0 || c.type==='GUILD_TEXT')).map(c=>({ id:c.id, name:c.name })) : [];
  const menus = getReactionMenus(guildId);
  // Best-effort: annotate existence
  for(const m of menus){
    try{
      const ch = m.channel_id ? await guild.channels.fetch(m.channel_id).catch(()=>null) : null;
      let exists = false;
      if(ch && 'messages' in ch && ch.messages){
        const msg = await ch.messages.fetch(m.message_id).catch(()=>null);
        exists = !!msg;
      }
      m.exists = exists;
    }catch(e){ m._exists = null; }
  }
  return res.render('rolesMenus', { guild, guildId, textChannels, menus });
});

// Re-sync reactions for a menu: (re)add configured reactions to the target message
app.post('/dashboard/guild/:guildId/roles/menu/:menuId/sync', requireLogin, async (req, res) => {
  const { guildId, menuId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try{
    const menu = getReactionMenuById(Number(menuId));
    if(!menu || String(menu.guild_id)!==String(guildId)) return res.status(404).send('Menu not found');
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild) return res.status(400).send('Guild not found');
    const ch = menu.channel_id ? await guild.channels.fetch(menu.channel_id).catch(()=>null) : null;
    if(!ch || !('messages' in ch)) return res.status(400).send('Channel not accessible');
    const msg = await ch.messages.fetch(menu.message_id).catch(()=>null);
    if(!msg) return res.status(404).send('Message not found');
    let added = 0;
    for(const r of (menu.roles||[])){
      if(!r.emoji) continue;
      try{ await msg.react(r.emoji); added++; }catch(_){ }
    }
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Synced reactions on menu ${menuId} (${added} attempts)`, action_type: 'dashboard' }); }catch(_){ }
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok:true, added });
    return res.redirect(`/dashboard/guild/${guildId}/roles/menus`);
  }catch(e){
    return res.status(400).send('Failed to sync: ' + (e?.message || 'Unknown error'));
  }
});

// Bulk delete selected menus
app.post('/dashboard/guild/:guildId/roles/menus/bulk_delete', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try{
    const ids = (Array.isArray(req.body.ids) ? req.body.ids : String(req.body.ids||'').split(',')).map(s=> Number(String(s).trim())).filter(n=> Number.isFinite(n) && n>0);
    if(!ids.length) return res.status(400).send('No ids provided');
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    let deleted = 0; let msgDeleted = 0;
    for(const id of ids){
      const m = getReactionMenuById(id);
      if(!m || String(m.guild_id)!==String(guildId)) continue;
      try{
        const ch = m.channel_id ? await guild?.channels.fetch(m.channel_id).catch(()=>null) : null;
        if (ch && 'messages' in ch && ch.messages){
          const msg = await ch.messages.fetch(m.message_id).catch(()=>null);
          if (msg){ await msg.delete().catch(()=>{}); msgDeleted++; }
        }
      }catch(_){ }
      deleteReactionMenu(id); deleted++;
    }
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Bulk deleted ${deleted} reaction role menus (${msgDeleted} messages)`, action_type: 'dashboard' }); }catch(_){ }
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok:true, deleted, msgDeleted });
    return res.redirect(`/dashboard/guild/${guildId}/roles/menus`);
  }catch(e){
    return res.status(400).send('Failed to bulk delete: ' + (e?.message || 'Unknown error'));
  }
});

// Create a reaction roles menu
app.post('/dashboard/guild/:guildId/roles/menu', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try{
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild) throw new Error('Guild not found');
    await guild.channels.fetch(); await guild.roles.fetch();
    const channelId = String(req.body.channel_id||'');
    const title = (req.body.title||'Choose your roles').toString().slice(0, 200);
    const name = (req.body.name||'').toString().slice(0, 120) || null;
    const selection_type_raw = (req.body.selection_type||'reactions').toString().toLowerCase();
    const selection_type = ['reactions','buttons','dropdowns'].includes(selection_type_raw) ? selection_type_raw : 'reactions';
    const message_type_raw = (req.body.message_type||'plain').toString().toLowerCase();
    const message_type = ['plain','embed','existing'].includes(message_type_raw) ? message_type_raw : 'plain';
  const embed_json = (req.body.embed_json||'').toString() || null;
  const existing_message_raw = (req.body.existing_message_id||'').toString().trim();
    const allow_multi = (req.body.allow_multi==='1' || req.body.allow_multi==='true' || req.body.allow_multi===1) ? 1 : 0;
    const reverse_mode = (req.body.reverse_mode==='1' || req.body.reverse_mode==='true' || req.body.reverse_mode===1) ? 1 : 0;
    const allowed_roles = (req.body.allowed_roles||'').toString().trim() || null;
    const ignored_roles = (req.body.ignored_roles||'').toString().trim() || null;
    const roleIds = Array.isArray(req.body.role_ids) ? req.body.role_ids : (req.body.role_ids ? [req.body.role_ids] : []);
    // Normalize emoji input: store unicode emoji as-is; for custom emojis, store ID string
    const normEmoji = (raw) => {
      if(!raw) return null;
      const s = String(raw).trim();
      let m;
      m = s.match(/^<a?:\w+:(\d{16,22})>$/); if(m) return m[1];
      m = s.match(/^\w+:(\d{16,22})$/); if(m) return m[1];
      m = s.match(/^(\d{16,22})$/); if(m) return m[1];
      return s; // assume unicode
    };
    // Extract optional emoji fields (emoji_<roleId>) mapping
    const rolesWithMeta = roleIds.map((rid)=>({ role_id: String(rid), emoji: normEmoji((req.body['emoji_'+String(rid)] || '').toString()) }));
  const ch = await guild.channels.fetch(channelId).catch(()=>null);
  if(!ch) throw new Error('Invalid channel');
    // Build message payload
    const components = [];
    if (selection_type === 'buttons') {
      const row = new ActionRowBuilder();
      for(const rid of roleIds.slice(0,5)){
        const r = guild.roles.cache.get(String(rid));
        if(!r) continue;
        const btn = new ButtonBuilder().setCustomId('rr:'+r.id).setLabel('@'+r.name).setStyle(ButtonStyle.Primary);
        row.addComponents(btn);
      }
      if (row.components?.length) components.push(row);
    } else if (selection_type === 'dropdowns') {
      const opts = [];
      for(const rid of roleIds){
        const r = guild.roles.cache.get(String(rid));
        if(!r) continue;
        opts.push({ label: '@'+r.name, value: r.id });
      }
      const max = allow_multi ? Math.min(opts.length || 1, 25) : 1;
  const select = new StringSelectMenuBuilder().setCustomId('rrs').setPlaceholder('Choose roles...').setMinValues(0).setMaxValues(max).addOptions(opts.slice(0,25));
      const row = new ActionRowBuilder().addComponents(select);
      components.push(row);
    }
  // Content/embeds based on message_type
  let payload = { content: '**'+title+'**' };
    if (message_type === 'embed') {
      try{
        const ej = embed_json ? JSON.parse(embed_json) : {};
        const e = new EmbedBuilder();
        if (title) { try { e.setTitle(title); } catch(_){} }
        if (ej.description) { try { e.setDescription(String(ej.description)); } catch(_){} }
        if (ej.color) {
          if (typeof ej.color === 'string'){
            let s = ej.color.trim();
            if (/^#?[0-9a-f]{6}$/i.test(s)) { s = s.replace('#',''); e.setColor(parseInt(s,16)); }
            else if (/^0x[0-9a-f]{6}$/i.test(s)) { e.setColor(parseInt(s,16)); }
            else if (/^[0-9]+$/.test(s)) { e.setColor(parseInt(s,10)); }
          } else if (typeof ej.color === 'number') { e.setColor(ej.color); }
        }
        if (ej.thumbnail) { try{ e.setThumbnail(String(ej.thumbnail)); }catch(_){} }
        if (ej.image) { try{ e.setImage(String(ej.image)); }catch(_){} }
        if (ej.fields && Array.isArray(ej.fields)){
          try{ e.addFields(ej.fields.filter(f=>f && f.name && f.value).slice(0,25).map(f=>({ name:String(f.name).slice(0,256), value:String(f.value).slice(0,1024), inline: !!f.inline }))); }catch(_){}
        }
        payload = { embeds: [e] };
      }catch(_){ payload = { content: '**'+title+'**' }; }
    }
  let messageIdCreated = null;
  let storedChannelId = ch.id;
    if (message_type === 'existing') {
      // Only support reactions for existing message
      if (selection_type !== 'reactions') throw new Error('Existing message only supports Reactions selection type');
      // Resolve message ID from URL or ID
      const resolveMessageId = (s)=>{
        const t = String(s||'').trim();
        let m = t.match(/\/channels\/(\d+)\/(\d+)\/(\d+)/); if(m) return { chId:m[2], msgId:m[3] };
        if(/^(\d{16,22})$/.test(t)) return { chId: channelId, msgId: t };
        return null;
      };
      const ref = resolveMessageId(existing_message_raw);
      if(!ref) throw new Error('Invalid existing message link or ID');
      const targetCh = ref.chId && ref.chId !== channelId ? await guild.channels.fetch(ref.chId).catch(()=>null) : ch;
      if(!targetCh || !('messages' in targetCh)) throw new Error('Cannot access target message channel');
      const targetMsg = await targetCh.messages.fetch(ref.msgId).catch(()=>null);
      if(!targetMsg) throw new Error('Existing message not found');
      // React with provided emojis
      for(const r of rolesWithMeta){
        if(r.emoji){ try{ await targetMsg.react(r.emoji); }catch(_){ } }
      }
  messageIdCreated = targetMsg.id;
  storedChannelId = targetCh.id;
    } else {
      if(!('send' in ch)) throw new Error('Invalid text channel');
      if (components.length) payload.components = components;
      const msg = await ch.send(payload);
      messageIdCreated = msg.id;
      storedChannelId = ch.id;
      for(const r of rolesWithMeta){
        if(r.emoji){ try{ await msg.react(r.emoji); }catch(_){ } }
      }
    }
    addReactionMenu({ guild_id: guildId, channel_id: storedChannelId, message_id: messageIdCreated, roles: rolesWithMeta, name, selection_type, message_type, title, embed_json, allow_multi, reverse_mode, allowed_roles, ignored_roles });
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Created reaction roles menu in #${ch.name}`, action_type: 'dashboard' }); }catch(e){}
    return res.redirect(`/dashboard/guild/${guildId}/roles`);
  }catch(e){
    return res.status(400).send('Failed to create menu: ' + (e?.message || 'Unknown error'));
  }
});

// Delete a reaction roles menu (removes from DB only; does not delete Discord message)
app.post('/dashboard/guild/:guildId/roles/menu/:menuId/delete', requireLogin, async (req, res) => {
  const { guildId, menuId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try{
    const menu = getReactionMenuById(Number(menuId));
    if(!menu || String(menu.guild_id)!==String(guildId)) return res.status(404).send('Menu not found');
    // Best-effort: delete the Discord message too
    try{
      const guild = await client.guilds.fetch(guildId).catch(()=>null);
      const ch = menu.channel_id ? await guild?.channels.fetch(menu.channel_id).catch(()=>null) : null;
      if (ch && 'messages' in ch && ch.messages) {
        const msg = await ch.messages.fetch(menu.message_id).catch(()=>null);
        if (msg) await msg.delete().catch(()=>{});
      }
    }catch(_){ }
    deleteReactionMenu(Number(menuId));
    try{ console.log('[roles] deleted menu', menuId, 'in guild', guildId); }catch(_){ }
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Deleted reaction roles menu ${menuId}`, action_type: 'dashboard' }); }catch(e){}
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok:true });
    return res.redirect(`/dashboard/guild/${guildId}/roles`);
  }catch(e){
    return res.status(400).send('Failed to delete menu: ' + (e?.message || 'Unknown error'));
  }
});

// Fallback delete via link (GET) to support simple anchors/buttons
app.get('/dashboard/guild/:guildId/roles/menu/:menuId/delete', requireLogin, async (req, res) => {
  const { guildId, menuId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  // Reuse POST logic by calling same code path
  req.headers['x-requested-with'] = '';
  try{
    const menu = getReactionMenuById(Number(menuId));
    if(menu){
      try{
        const guild = await client.guilds.fetch(guildId).catch(()=>null);
        const ch = menu.channel_id ? await guild?.channels.fetch(menu.channel_id).catch(()=>null) : null;
        if (ch && 'messages' in ch && ch.messages) {
          const msg = await ch.messages.fetch(menu.message_id).catch(()=>null);
          if (msg) await msg.delete().catch(()=>{});
        }
      }catch(_){ }
      deleteReactionMenu(Number(menuId));
      try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Deleted reaction roles menu ${menuId} (link)`, action_type: 'dashboard' }); }catch(e){}
    }
  }catch(_){ }
  return res.redirect(`/dashboard/guild/${guildId}/roles/menus`);
});

// Bulk prune menus whose messages no longer exist
app.post('/dashboard/guild/:guildId/roles/menus/prune_missing', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try{
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    const menus = getReactionMenus(guildId);
    let pruned = 0;
    for(const m of menus){
      let exists = false;
      try{
        const ch = m.channel_id ? await guild?.channels.fetch(m.channel_id).catch(()=>null) : null;
        if (ch && 'messages' in ch && ch.messages){
          const msg = await ch.messages.fetch(m.message_id).catch(()=>null);
          exists = !!msg;
        }
      }catch(_){ exists = false; }
      if(!exists){ deleteReactionMenu(m.id); pruned++; }
    }
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Pruned ${pruned} reaction role menus (missing messages)`, action_type: 'dashboard' }); }catch(e){}
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok:true, pruned });
    return res.redirect(`/dashboard/guild/${guildId}/roles/menus`);
  }catch(e){
    return res.status(400).send('Failed to prune: ' + (e?.message || 'Unknown error'));
  }
});

// Guild dashboard (module cards)
app.get('/dashboard', requireLogin, async (req, res) => {
  const guildId = req.query.guild_id;
  if (!guildId && req.session?.lastGuildId) {
    return res.redirect(`/dashboard?guild_id=${encodeURIComponent(req.session.lastGuildId)}`);
  }
  // If no guild selected, render a generic dashboard landing page
  if (!guildId) {
    const modules = [
      { title: 'Welcome', desc: 'Welcome new members with a message or embed.', settingsHref: '/servers', toggleHref: '/servers', enabled: false },
      { title: 'Reaction Roles', desc: 'Members click buttons to get roles.', settingsHref: '/servers', toggleHref: '/servers', enabled: false },
      { title: 'Go‑Live Alerts', desc: 'Announce Twitch & YouTube streams.', settingsHref: '/servers', toggleHref: '/servers', enabled: false },
      { title: 'Tickets', desc: 'Open/close private support tickets.', settingsHref: '/servers', toggleHref: '/servers', enabled: false },
      { title: 'Music', desc: 'Play music in voice channels.', settingsHref: '/servers', toggleHref: '/servers', enabled: false }
    ];
    return res.type('html').send(renderDashboard({ guild: null, cards: modules }));
  }
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('You do not have Manage Server in this guild.');
  try { if (req.session) req.session.lastGuildId = guildId; } catch(e) {}

  // Fetch Discord guild (for name/icon) — ignore failures
  const guild = await client.guilds.fetch(guildId).catch(()=>null);
  // If we fetched the guild, also fetch channels and roles caches so server-side templates can compute counts and selects
  if (guild) {
    try { await guild.channels.fetch(); } catch (e) { /* ignore */ }
    try { await guild.roles.fetch(); } catch (e) { /* ignore */ }
    // Note: we avoid fetching all members here (guild.members.fetch()) since that can be heavy; use guild.memberCount instead
  }

  // fetch module enabled/disabled states
  const moduleStates = getModuleStates(guildId);
  // Build cards from central list
  const cards = modulesList.map(m => ({
    title: m.name,
    desc: m.desc || '',
    icon: m.icon || '',
    category: m.category || '',
    settingsHref: m.href(guildId),
    toggleHref: `/dashboard/guild/${guildId}/${m.key}/toggle`,
    enabled: !!moduleStates[m.key]
  }));

  // recent web UI actions for this guild (limit to 5 for dashboard summary)
  let recentLogs = [];
  try{
    recentLogs = getWebLogsForGuild(guildId, 5, 0);
  }catch(e){ recentLogs = []; }

  // Enrich logs: add href to relevant settings and user avatars when available
  try{
    const toHref = (actionRaw='') => {
      const a = String(actionRaw||'');
      const al = a.toLowerCase();
      // Welcome Channel explicit
      if (al.includes('welcome channel')) return modulesList.find(m=>m.key==='welcome_channel')?.href(guildId) || null;
      // Plain Welcome (avoid double-catching welcome channel)
      if (al.includes('welcome') && !al.includes('welcome channel')) return modulesList.find(m=>m.key==='welcome')?.href(guildId) || null;
      // Module toggles: "Enabled module: <module>"
      const m = a.match(/\b(?:Enabled|Disabled) module:\s*([a-zA-Z0-9_\-]+)/i);
      if (m && m[1]){
        const key = m[1].toLowerCase();
        const mod = modulesList.find(x=>x.key===key);
        if (mod) return mod.href(guildId);
      }
      // Nickname change → dashboard
      if (al.includes('nickname')) return `/dashboard?guild_id=${encodeURIComponent(guildId)}`;
      return null;
    };

  // Attach href
  recentLogs = recentLogs.map(l => ({ ...l, href: toHref(l.action) }));

    // Friendly text mapping (Dyno-like)
    const friendly = (a='') => {
      const s = String(a||'');
      let m;
      m = s.match(/^Saved welcome settings \(enabled=([^,]+),\s*channel=([^\)]+)\)/i);
      if(m){ const en=m[1]; const ch=m[2]; return (ch && ch!=='none') ? `Changed welcome.channel setting: ${ch}` : `Changed welcome.enabled setting: ${en==='1'?'true':en}`; }
      m = s.match(/^Saved Welcome Channel \(enabled=([^,]+),\s*channel=([^\)]+)\)/i);
      if(m){ const en=m[1]; const ch=m[2]; return (ch && ch!=='none') ? `Changed welcome.channel setting: ${ch}` : `Changed welcome.enabled setting: ${en==='1'?'true':en}`; }
      m = s.match(/^(Enabled|Disabled) module:\s*([a-z0-9_\-]+)/i);
      if(m){ const en = m[1].toLowerCase()==='enabled'; const key=m[2]; return `Changed ${key}.enabled setting: ${en?'true':'false'}`; }
      m = s.match(/^Changed nickname to\s+(.+)$/i);
      if(m){ return `Name updated to ${m[1]}`; }
      m = s.match(/^Updated bot nickname to\s+\"([^\"]*)\"/i);
      if(m){ return `Name updated to ${m[1]||'(none)'}`; }
      m = s.match(/^Changed welcome\.type setting:\s*(.*)$/i);
      if(m){ return `Changed welcome.type setting: ${m[1]}`; }
      return s;
    };

    // Replace channel IDs with channel names like #general when possible
    const replaceChannelIds = (text='') => {
      try{
        if (!guild) return text;
        const re = /\b\d{16,22}\b/g;
        return String(text).replace(re, (id)=>{
          const ch = guild.channels?.cache?.get?.(id);
          return ch && ch.name ? ('#' + ch.name) : id;
        });
      }catch(e){ return text; }
    };

    recentLogs = recentLogs.map(l => ({ ...l, action: replaceChannelIds(friendly(l.action || '')) }));

    // Attach avatars (if client is ready)
    const ids = Array.from(new Set(recentLogs.map(l=>l.user_id).filter(Boolean)));
    const avatars = {};
    if (ids.length && client && client.token){
      // Try global user fetch; ignore failures
      await Promise.all(ids.map(async (id)=>{
        try{
          const user = await client.users.fetch(id);
          avatars[id] = user?.displayAvatarURL?.({ size: 32, extension: 'png' }) || null;
        }catch(e){ avatars[id] = null; }
      }));
    }
    recentLogs = recentLogs.map(l => ({ ...l, avatarUrl: l.user_id ? avatars[l.user_id] || null : null }));
  }catch(e){ /* swallow */ }

  // Bot settings for this guild
  const botSettings = getBotSettings(guildId);
  const managerRoleIds = getManagerRoles(guildId);
  // Determine current bot nickname similar to Welcome page logic
  let botNickname = '';
  try{
    const wrow = db.prepare('SELECT bot_nickname FROM welcome_settings WHERE guild_id=?').get(guildId) || {};
    botNickname = wrow.bot_nickname || '';
    if(!botNickname && guild){
      const me = await guild.members.fetchMe().catch(()=>null);
      botNickname = (me && me.nickname) ? me.nickname : (client.user?.username || 'Forge Hammer');
    }
  }catch(e){ botNickname = client.user?.username || 'Forge Hammer'; }
  // Text channels for Updates Channel select
  const textChannels = guild ? Array.from(guild.channels.cache.values()).filter(c=> (c.type===0 || c.type==='GUILD_TEXT')).map(c=>({ id:c.id, name:c.name })) : [];
  // Bot's own roles in this guild (for collapsed view)
  let botRoles = [];
  let botTopPosition = 0;
  try{
    if(guild){
      const me = await guild.members.fetchMe().catch(()=>null);
      if(me){
        botTopPosition = me.roles?.highest?.position || 0;
        botRoles = Array.from(me.roles.cache.values()).filter(r=> r && r.id !== guild.id && !r.managed)
          .sort((a,b)=> (b.position||0)-(a.position||0))
          .map(r=> ({ id: r.id, name: r.name, position: r.position||0 }));
      }
    }
  }catch(e){ botRoles = []; }

  return res.type('html').send(renderDashboard({ guild, cards, recentLogs, botSettings, textChannels, botNickname, managerRoleIds, botRoles, botTopPosition }));
});

// Save Bot Settings
app.post('/dashboard/guild/:guildId/bot/settings', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const prefix = (req.body.prefix || '?').toString().trim().slice(0, 5) || '?';
  const updates_channel_id = (req.body.updates_channel_id || '').toString().trim() || null;
  const timezone = (req.body.timezone || '').toString().trim() || null;
  setBotSettings({ guild_id: guildId, prefix, updates_channel_id, timezone });
  // If manager roles were included with this settings form, persist them too
  try{
    const roleIds = [];
    if(Array.isArray(req.body.role_id)){
      for(const r of req.body.role_id){ const v = String(r||'').trim(); if(v) roleIds.push(v); }
    }else if(req.body.role_id){ const v = String(req.body.role_id).trim(); if(v) roleIds.push(v); }
    if(roleIds.length >= 0){
      setManagerRoles(guildId, roleIds);
      try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed manager roles (${roleIds.length})`, action_type: 'dashboard' }); }catch(e){}
    }
  }catch(e){}
  try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed bot settings: prefix=${prefix}, channel=${updates_channel_id||'(none)'}, timezone=${timezone||'(auto)'}`, action_type: 'dashboard' }); }catch(e){}
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok: true });
  return res.redirect(`/dashboard?guild_id=${encodeURIComponent(guildId)}`);
});

// Assign a role to the bot itself (must be below bot's top role and not managed)
app.post('/dashboard/guild/:guildId/bot/self-roles/add', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const roleId = (req.body.role_id || '').toString().trim();
  if(!roleId) return res.status(400).send('role_id is required');
  try{
    console.log('[self-roles:add] guild', guildId, 'role', roleId, 'by user', req.session?.user?.id);
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild) throw new Error('Guild not found');
    await guild.roles.fetch().catch(()=>null);
    const role = guild.roles.cache.get(roleId);
    if(!role) throw new Error('Role not found');
    if(role.managed) throw new Error('Cannot assign a managed role');
    if(role.id === guild.id) throw new Error('Cannot assign @everyone');
    const me = await guild.members.fetchMe().catch(()=>null);
    if(!me) throw new Error('Bot member not found');
    // Permission and hierarchy checks
    if(!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) throw new Error('Bot lacks Manage Roles permission');
    const top = me.roles?.highest?.position || 0;
    if(role.position >= top) throw new Error('Cannot assign a role equal or higher than bot\'s top role');
    // already has?
    if(me.roles.cache.has(role.id)){
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok: true, already: true });
      return res.redirect(`/dashboard?guild_id=${encodeURIComponent(guildId)}`);
    }
    console.log('[self-roles:add] adding role', role.id, 'to bot');
    await me.roles.add(role.id);
    console.log('[self-roles:add] added OK');
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Bot assigned role @${role.name}`, action_type: 'dashboard' }); }catch(e){}
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok: true });
    return res.redirect(`/dashboard?guild_id=${encodeURIComponent(guildId)}`);
  }catch(e){
    console.warn('[self-roles:add] failed:', e?.message || e);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest'){
      return res.status(400).json({ ok:false, error: e?.message || 'Unknown error' });
    }
    return res.status(400).send('Failed to assign role: ' + (e?.message || 'Unknown error'));
  }
});

// In-memory guard to avoid double-click duplicate sends
const __recentTestSends = new Map();

// Save manager roles
app.post('/dashboard/guild/:guildId/bot/manager-roles', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const roleIds = [];
  try{
    if(Array.isArray(req.body.role_id)){
      for(const r of req.body.role_id){ const v = String(r||'').trim(); if(v) roleIds.push(v); }
    }else if(req.body.role_id){ const v = String(req.body.role_id).trim(); if(v) roleIds.push(v); }
  }catch(e){}
  setManagerRoles(guildId, roleIds);
  try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed manager roles (${roleIds.length})`, action_type: 'dashboard' }); }catch(e){}
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok: true });
  return res.redirect(`/dashboard?guild_id=${encodeURIComponent(guildId)}`);
});

// Send a test update message to the configured updates channel
app.post('/dashboard/guild/:guildId/bot/send-test-update', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  // debounce within 3 seconds per guild
  try{
    const now = Date.now();
    const last = __recentTestSends.get(guildId) || 0;
    if(now - last < 3000){
      return res.status(202).json({ ok: true, skipped: true });
    }
    __recentTestSends.set(guildId, now);
  }catch(e){}
  const settings = getBotSettings(guildId);
  const channelId = settings.updates_channel_id || '';
  try{
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild) throw new Error('Guild not found');
    const ch = channelId ? await guild.channels.fetch(channelId).catch(()=>null) : null;
    if(!ch || !('send' in ch)) throw new Error('Updates channel not set or invalid');
    await ch.send({ content: 'Test update: Bot settings updates channel is configured correctly.' });
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Sent test update to #${ch.name}`, action_type: 'dashboard' }); }catch(e){}
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok: true });
    return res.redirect(`/dashboard?guild_id=${encodeURIComponent(guildId)}`);
  }catch(e){
    return res.status(400).send('Failed to send test update: ' + (e?.message || 'Unknown error'));
  }
});

// Send an announcement to the configured Updates Channel
app.post('/dashboard/guild/:guildId/bot/announce', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const settings = getBotSettings(guildId);
  const channelId = settings.updates_channel_id || '';
  const content = (req.body.content || '').toString().slice(0, 2000);
  let embed = null;
  try{ embed = req.body.embed ? JSON.parse(req.body.embed) : null; }catch(e){ embed = null; }
  const mentionEveryone = req.body.mention_everyone === '1' || req.body.mention_everyone === 'true';
  const mentionRoleId = (req.body.mention_role_id || '').toString().trim() || null;
  try{
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild) throw new Error('Guild not found');
    const ch = channelId ? await guild.channels.fetch(channelId).catch(()=>null) : null;
    if(!ch || !('send' in ch)) throw new Error('Updates channel not set or invalid');
    const parts = [];
    if(mentionEveryone) parts.push('@everyone');
    if(mentionRoleId) parts.push('<@&'+mentionRoleId+'>');
    const header = parts.length ? parts.join(' ') + '\n\n' : '';
    const payload = { content: header + (content || '') };
    if(embed && Object.keys(embed).length){
      payload.embeds = [ new EmbedBuilder(embed).data ];
    }
    await ch.send(payload);
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Sent announcement to #${ch.name}`, action_type: 'dashboard' }); }catch(e){}
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok: true });
    return res.redirect(`/dashboard?guild_id=${encodeURIComponent(guildId)}`);
  }catch(e){
    return res.status(400).send('Failed to send announcement: ' + (e?.message || 'Unknown error'));
  }
});

// Toggle module enabled state
app.post('/dashboard/guild/:guildId/:module/toggle', requireLogin, async (req, res) => {
  const { guildId, module } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');

  // Accept either form value 'enabled' or toggle current state
  const desired = req.body.enabled;
  let enabled;
  if (typeof desired !== 'undefined') {
    enabled = desired === '1' || desired === 'true' || desired === 1 || desired === 'on';
  } else {
    // flip
    const states = getModuleStates(guildId);
    enabled = !states[module];
  }

  setModuleState(guildId, module, enabled ? 1 : 0);
  try{
    const who = req.session?.user?.username || 'Unknown';
    addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: who, action: `${enabled ? 'Enabled' : 'Disabled'} module: ${module}`, action_type: 'dashboard' });
  }catch(e){}
  return res.redirect(`/dashboard?guild_id=${encodeURIComponent(guildId)}`);
});

// Welcome settings — GET
app.get('/dashboard/guild/:guildId/welcome', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try { if (req.session) req.session.lastGuildId = guildId; } catch(e) {}
  const guild = await client.guilds.fetch(guildId).catch(()=>null);
  const row = db.prepare('SELECT * FROM welcome_settings WHERE guild_id=?').get(guildId) || { enabled: 0, channel_id: '', message_type: 'message', message_text: '', embed_json: null, bot_nickname: null };
  // recent web UI actions for this guild
  let recentLogs = [];
  try {
    recentLogs = db.prepare('SELECT id, action, action_type, created_at FROM web_logs WHERE guild_id=? ORDER BY created_at DESC LIMIT 8').all(guildId);
  } catch(e) { recentLogs = []; }

  // get text channels list
  const chs = guild ? await guild.channels.fetch() : null;
  const textChannels = chs ? [...chs.values()].filter(c=>c && c.type===0) : [];

  // Bot nickname for preview/input; prefer stored setting, else guild/me nickname, else bot username
  let botNickname = row.bot_nickname || '';
  try{
    if(!botNickname && guild){
      const me = guild.members?.me || await guild.members.fetchMe().catch(()=>null);
      botNickname = (me && me.nickname) ? me.nickname : (client.user?.username || 'Forge Hammer');
    }
  }catch(e){ botNickname = client.user?.username || 'Forge Hammer'; }

  const saved = !!req.query.saved;
  return res.type('html').send(renderWelcomeSettings({ guild, guildId, textChannels, settings: row, saved, recentLogs, botNickname }));
});

// Welcome Channel — dedicated page for the banner-style welcome card
app.get('/dashboard/guild/:guildId/welcome-channel', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try { if (req.session) req.session.lastGuildId = guildId; } catch(e) {}
  const guild = await client.guilds.fetch(guildId).catch(()=>null);
  const row = db.prepare('SELECT * FROM welcome_settings WHERE guild_id=?').get(guildId) || { enabled: 0, channel_id: '', custom_image_json: null };
  // get text channels list
  const chs = guild ? await guild.channels.fetch() : null;
  const textChannels = chs ? [...chs.values()].filter(c=>c && c.type===0) : [];
  const saved = !!req.query.saved;
  return res.type('html').send(renderWelcomeChannel({ guild, guildId, textChannels, settings: row, saved }));
});

// Per-guild server listing management page
app.get('/dashboard/guild/:guildId/listing', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const guild = await client.guilds.fetch(guildId).catch(()=>null);
  return res.type('html').send(renderServerListing({ guild, guildId }));
});

// Welcome settings — POST (save)
app.post('/dashboard/guild/:guildId/welcome', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');

  // Load existing row so we don't clobber fields when the form submits only a subset (e.g. header Publish)
  const existing = db.prepare('SELECT * FROM welcome_settings WHERE guild_id=?').get(guildId) || { enabled:0, channel_id:null, message_type:'message', message_text:'', embed_json: null, bot_nickname: null };

  const enabled = (typeof req.body.enabled !== 'undefined') ? (req.body.enabled === 'on' ? 1 : 0) : existing.enabled;
  const channel_id_raw = (typeof req.body.channel_id !== 'undefined') ? req.body.channel_id : existing.channel_id;
  const channel_id = channel_id_raw ? String(channel_id_raw) : null;
  const message_type = (typeof req.body.message_type !== 'undefined') ? req.body.message_type : existing.message_type || 'message';
  const message_text = (typeof req.body.message_text !== 'undefined') ? req.body.message_text : existing.message_text || '';
  const bot_nickname = (typeof req.body.bot_nickname !== 'undefined') ? (req.body.bot_nickname || null) : existing.bot_nickname || null;
  // Embed JSON (stringified)
  let embed_json_str = (typeof req.body.embed_json !== 'undefined') ? req.body.embed_json : existing.embed_json || null;
  if (embed_json_str && typeof embed_json_str !== 'string') embed_json_str = String(embed_json_str);
  // Custom image JSON (stringified)
  let custom_image_json = (typeof req.body.custom_image_json !== 'undefined') ? req.body.custom_image_json : existing.custom_image_json || null;
  if (custom_image_json && typeof custom_image_json !== 'string') custom_image_json = String(custom_image_json);

  console.log('Welcome save', { guildId, enabled, channel_id_raw, channel_id, message_type, message_text: (message_text||'').slice(0,120), embed_json_preview: (embed_json_str||'').slice(0,120) });
  try { if (message_type==='embed' || message_type==='embed_text') { console.log('Embed JSON incoming:', embed_json_str); } } catch(e) {}

  db.prepare(`INSERT INTO welcome_settings (guild_id, enabled, channel_id, message_type, message_text, embed_json, bot_nickname, custom_image_json)
              VALUES (@guild_id,@enabled,@channel_id,@message_type,@message_text,@embed_json,@bot_nickname,@custom_image_json)
              ON CONFLICT(guild_id) DO UPDATE SET enabled=@enabled, channel_id=@channel_id, message_type=@message_type, message_text=@message_text, embed_json=@embed_json, bot_nickname=@bot_nickname, custom_image_json=@custom_image_json`)
    .run({ guild_id: guildId, enabled, channel_id, message_type, message_text, embed_json: embed_json_str, bot_nickname, custom_image_json });

  // Granular change logs to mirror Dyno's style
  try {
    const normType = (t)=>({ message:'MESSAGE', embed:'EMBED', embed_text:'EMBED', custom_image:'CUSTOM_IMAGE' }[String(t||'').toLowerCase()] || String(t||'').toUpperCase());
    // enabled
    if ((existing.enabled ? 1 : 0) !== (enabled ? 1 : 0)) {
      addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed welcome.enabled setting: ${(enabled? 'true':'false')}`, action_type: 'dashboard' });
    }
    // channel
    if (String(existing.channel_id||'') !== String(channel_id||'')) {
      addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed welcome.channel setting: ${channel_id||'none'}`, action_type: 'dashboard' });
    }
    // type
    if (String(existing.message_type||'message') !== String(message_type||'message')) {
      addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed welcome.type setting: ${normType(message_type)}` , action_type: 'dashboard' });
    }
  } catch(e) {}

  // If enabled and we have a channel, try to send the welcome message to the channel and store message id
  try {
    if (enabled && channel_id) {
      const ch = await client.channels.fetch(channel_id).catch(()=>null);
      if (ch && ch.isTextBased && ch.send) {
        // delete previous message if exists
        const prev = db.prepare('SELECT last_message_id FROM welcome_settings WHERE guild_id=?').get(guildId);
        if (prev && prev.last_message_id) {
          try {
            const prevMsg = await ch.messages.fetch(prev.last_message_id).catch(()=>null);
            if (prevMsg) await prevMsg.delete().catch(()=>null);
          } catch(e) { /* ignore */ }
        }

        // Prepare content/embed based on message_type
        const isEmbedEmpty = (eb)=>{
          try{
            const j = typeof eb.toJSON === 'function' ? eb.toJSON() : (eb?.data || {});
            if(!j || Object.keys(j).length===0) return true;
            const has = !!(j.title || j.description || (Array.isArray(j.fields) && j.fields.length) || j.url || j.color || j.author || j.footer || j.image || j.thumbnail);
            return !has;
          }catch(e){ return true; }
        };
        let payload = {};
        if (message_type === 'message') {
          payload.content = message_text || '';
        } else if (message_type === 'embed' || message_type === 'embed_text') {
          // Try parse embed JSON
          let ej = null;
          try { ej = embed_json_str ? JSON.parse(embed_json_str) : null; } catch(e) { ej = null; }
          const embed = new EmbedBuilder();
          if (ej) {
            try {
              const trim = (s)=> typeof s==='string' ? s.trim() : s;
              if (trim(ej.title)) embed.setTitle(trim(ej.title));
              if (trim(ej.title_url)) embed.setURL(trim(ej.title_url));
              if (trim(ej.description)) embed.setDescription(trim(ej.description));
              if (ej.color) {
                // accept #rrggbb, 0xRRGGBB, numeric string, or int
                if (typeof ej.color === 'string') {
                  let s = ej.color.trim();
                  if (/^#?[0-9a-f]{6}$/i.test(s)) {
                    s = s.replace('#','');
                    embed.setColor(parseInt(s, 16));
                  } else if (/^0x[0-9a-f]{6}$/i.test(s)) {
                    embed.setColor(parseInt(s, 16));
                  } else if (/^[0-9]+$/.test(s)) {
                    embed.setColor(parseInt(s, 10));
                  }
                } else if (typeof ej.color === 'number') {
                  embed.setColor(ej.color);
                }
              }
              if (trim(ej.author_name) || trim(ej.author_icon)) embed.setAuthor({ name: trim(ej.author_name) || '\u200b', iconURL: trim(ej.author_icon) || undefined });
              if (trim(ej.thumbnail)) embed.setThumbnail(trim(ej.thumbnail));
              if (trim(ej.image)) embed.setImage(trim(ej.image));
              if (trim(ej.footer_text) || trim(ej.footer_icon)) embed.setFooter({ text: trim(ej.footer_text) || '\u200b', iconURL: trim(ej.footer_icon) || undefined });
              if (Array.isArray(ej.fields)) {
                const safeFields = ej.fields.filter(f=>f && f.name && f.value).slice(0,25).map(f=>({ name:String(f.name).slice(0,256), value:String(f.value).slice(0,1024), inline: !!f.inline }));
                if (safeFields.length) embed.addFields(safeFields);
              }
            } catch(e) { /* ignore bad embed */ }
          }
          // If embed has no content but we're in Embed mode, fallback to using message_text as description
          if (isEmbedEmpty(embed) && message_type === 'embed' && message_text) {
            try { embed.setDescription(message_text); } catch(e) {}
          }
          // Add embed if it now has content
          if (!isEmbedEmpty(embed)) {
            payload.embeds = [embed];
          }
          // For embed+text, always keep the text content; for embed-only, only include content if we still have no embed
          if (message_type === 'embed_text' && message_text) payload.content = message_text;
          if (message_type === 'embed' && (!payload.embeds || !payload.embeds.length)) {
            payload.content = message_text || ' ';
          }
        } else if (message_type === 'custom_image') {
          // Prefer the composed banner data URL if provided, else use backgroundUrl
          try {
            const dataUrl = req.body.custom_image_data || null;
            if (dataUrl && /^data:image\/(png|jpeg|jpg);base64,/.test(dataUrl)) {
              const b64 = dataUrl.split(',')[1];
              const buf = Buffer.from(b64, 'base64');
              payload.files = [{ attachment: buf, name: 'welcome-banner.png' }];
            } else {
              const cfg = custom_image_json ? JSON.parse(custom_image_json) : null;
              const imgUrl = cfg?.backgroundUrl || null;
              if (imgUrl) {
                // Use an embed with image for URL-based banners for better reliability
                const e = new EmbedBuilder();
                e.setImage(imgUrl);
                payload.embeds = [...(payload.embeds||[]), e];
              }
            }
          } catch (e) { /* ignore */ }
        }
  const sent = await ch.send((payload.content || (payload.embeds && payload.embeds.length) || (payload.files && payload.files.length)) ? payload : (message_text || ' '));
        const lastId = sent && sent.id ? sent.id : null;
        const now = Date.now();
        db.prepare('UPDATE welcome_settings SET last_message_id=@last_message_id, last_sent_at=@last_sent_at WHERE guild_id=@guild_id')
          .run({ last_message_id: lastId, last_sent_at: now, guild_id: guildId });
      }
    }
  } catch (e) {
    console.error('Failed to send welcome preview message', e);
  }

  return res.redirect(`/dashboard/guild/${guildId}/welcome?saved=1`);
});

// Welcome: send a quick test to the configured channel without changing settings
app.post('/dashboard/guild/:guildId/welcome/test', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  try{
    const row = db.prepare('SELECT * FROM welcome_settings WHERE guild_id=?').get(guildId);
    if(!row || !row.channel_id) return res.status(400).send('No welcome channel configured');
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if(!guild) return res.status(400).send('Guild not found');
    const ch = await client.channels.fetch(row.channel_id).catch(()=>null);
    if(!ch || !ch.isTextBased || !ch.send) return res.status(400).send('Invalid welcome channel');
    // Build a lightweight preview message similar to save handler
    const message_type = row.message_type || 'message';
    const message_text = row.message_text || '';
    let embed_json_str = row.embed_json || null;
    let payload = {};
    if (message_type === 'message') {
      payload.content = message_text || ' ';
    } else if (message_type === 'embed' || message_type === 'embed_text') {
      const embed = new EmbedBuilder();
      try { const ej = embed_json_str ? JSON.parse(embed_json_str) : null; if (ej){
        const trim = (s)=> typeof s==='string' ? s.trim() : s;
        if (trim(ej.title)) embed.setTitle(trim(ej.title));
        if (trim(ej.title_url)) embed.setURL(trim(ej.title_url));
        if (trim(ej.description)) embed.setDescription(trim(ej.description));
        if (ej.color){ if (typeof ej.color==='string'){ let s=ej.color.trim(); if(/^#?[0-9a-f]{6}$/i.test(s)){ s=s.replace('#',''); embed.setColor(parseInt(s,16)); } else if(/^0x[0-9a-f]{6}$/i.test(s)){ embed.setColor(parseInt(s,16)); } else if(/^[0-9]+$/.test(s)){ embed.setColor(parseInt(s,10)); } } else if (typeof ej.color==='number'){ embed.setColor(ej.color); } }
        if (trim(ej.author_name) || trim(ej.author_icon)) embed.setAuthor({ name: trim(ej.author_name) || '\u200b', iconURL: trim(ej.author_icon) || undefined });
        if (trim(ej.thumbnail)) embed.setThumbnail(trim(ej.thumbnail));
        if (trim(ej.image)) embed.setImage(trim(ej.image));
        if (trim(ej.footer_text) || trim(ej.footer_icon)) embed.setFooter({ text: trim(ej.footer_text) || '\u200b', iconURL: trim(ej.footer_icon) || undefined });
        if (Array.isArray(ej.fields)) {
          const safe = ej.fields.filter(f=>f && f.name && f.value).slice(0,25).map(f=>({ name:String(f.name).slice(0,256), value:String(f.value).slice(0,1024), inline: !!f.inline }));
          if (safe.length) embed.addFields(safe);
        }
      }} catch(e){}
      if (message_type === 'embed_text' && message_text) payload.content = message_text;
      if ((embed.data && Object.keys(embed.data).length) || embed.toJSON && Object.keys(embed.toJSON()).length) payload.embeds = [embed];
      if (!payload.content && !payload.embeds) payload.content = message_text || ' ';
    } else if (message_type === 'custom_image') {
      payload.content = '(welcome banner preview)';
    }
    await ch.send(payload);
    try{ addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Sent test welcome to #${ch.name}` , action_type: 'dashboard' }); }catch(e){}
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok:true });
    return res.redirect(`/dashboard/guild/${guildId}/welcome?saved=1`);
  }catch(e){
    return res.status(400).send('Failed to send test welcome: ' + (e?.message || 'Unknown error'));
  }
});

// Welcome Channel — POST (save)
app.post('/dashboard/guild/:guildId/welcome-channel', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');

  const existing = db.prepare('SELECT * FROM welcome_settings WHERE guild_id=?').get(guildId) || { enabled:0, channel_id:null, message_type:'custom_image', custom_image_json: null };
  const enabled = (typeof req.body.enabled !== 'undefined') ? (req.body.enabled === 'on' ? 1 : 0) : existing.enabled;
  const channel_id_raw = (typeof req.body.channel_id !== 'undefined') ? req.body.channel_id : existing.channel_id;
  const channel_id = channel_id_raw ? String(channel_id_raw) : null;
  let custom_image_json = (typeof req.body.custom_image_json !== 'undefined') ? req.body.custom_image_json : existing.custom_image_json || null;
  if (custom_image_json && typeof custom_image_json !== 'string') custom_image_json = String(custom_image_json);

  db.prepare(`INSERT INTO welcome_settings (guild_id, enabled, channel_id, message_type, custom_image_json)
              VALUES (@guild_id,@enabled,@channel_id,@message_type,@custom_image_json)
              ON CONFLICT(guild_id) DO UPDATE SET enabled=@enabled, channel_id=@channel_id, message_type=@message_type, custom_image_json=@custom_image_json`)
    .run({ guild_id: guildId, enabled, channel_id, message_type: 'custom_image', custom_image_json });
  // Granular change logs for welcome_channel
  try {
    if ((existing.enabled ? 1 : 0) !== (enabled ? 1 : 0)) {
      addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed welcome_channel.enabled setting: ${(enabled? 'true':'false')}`, action_type: 'dashboard' });
    }
    if (String(existing.channel_id||'') !== String(channel_id||'')) {
      addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed welcome_channel.channel setting: ${channel_id||'none'}`, action_type: 'dashboard' });
    }
  } catch(e) {}

  // Send preview/banner if enabled (always post a new message; do not delete previous)
  try {
    if (enabled && channel_id) {
      const ch = await client.channels.fetch(channel_id).catch(()=>null);
      if (ch && ch.isTextBased && ch.send) {
        let payload = {};
        try {
          const dataUrl = req.body.custom_image_data || null;
          if (dataUrl && /^data:image\/(png|jpeg|jpg);base64,/.test(dataUrl)) {
            const b64 = dataUrl.split(',')[1];
            const buf = Buffer.from(b64, 'base64');
            payload.files = [{ attachment: buf, name: 'welcome-banner.png' }];
          } else {
            const cfg = custom_image_json ? JSON.parse(custom_image_json) : null;
            const imgUrl = cfg?.backgroundUrl || null;
            if (imgUrl) {
              const e = new EmbedBuilder();
              e.setImage(imgUrl);
              payload.embeds = [e];
            }
          }
        } catch (e) {}
        const sent = await ch.send((payload.embeds && payload.embeds.length) || (payload.files && payload.files.length) ? payload : { content: ' ' });
        const lastId = sent && sent.id ? sent.id : null;
        db.prepare('UPDATE welcome_settings SET last_message_id=@last_message_id, last_sent_at=@last_sent_at WHERE guild_id=@guild_id')
          .run({ last_message_id: lastId, last_sent_at: Date.now(), guild_id: guildId });
      }
    }
  } catch (e) {
    console.error('Failed to send Welcome Channel preview', e);
  }

  return res.redirect(`/dashboard/guild/${guildId}/welcome-channel?saved=1`);
});

// Set bot nickname in a guild (optional quick win)
app.post('/dashboard/guild/:guildId/bot/nickname', requireLogin, async (req, res) => {
  const { guildId } = req.params;
  if (!userCanManageGuild(req, guildId)) return res.status(403).send('Forbidden');
  const nick = (req.body.nickname || '').toString().trim().slice(0, 32);
  try{
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if (!guild) throw new Error('Guild not found or bot not in guild');
    const me = guild.members.me || await guild.members.fetchMe();
    if (!me) throw new Error('Bot member not found');
    await me.setNickname(nick || null).catch(()=>{ throw new Error('Failed to set nickname (missing permission?)'); });
    // Persist preference into welcome_settings for previews
    db.prepare(`INSERT INTO welcome_settings (guild_id, bot_nickname)
                VALUES (@guild_id, @bot_nickname)
                ON CONFLICT(guild_id) DO UPDATE SET bot_nickname=@bot_nickname`).run({ guild_id: guildId, bot_nickname: nick || null });
  try { addWebLog({ guild_id: guildId, user_id: req.session?.user?.id, username: req.session?.user?.username, action: `Changed nickname to ${nick || '(none)'}`, action_type: 'dashboard' }); } catch(e){}
    // Allow AJAX/XHR without redirect
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.json({ ok: true, nickname: nick });
    return res.redirect(`/dashboard/guild/${guildId}/welcome?saved=1`);
  }catch(e){
    console.error('Nickname update failed', e);
    if (req.headers['x-requested-with'] === 'XMLHttpRequest') return res.status(400).json({ ok:false, error: (e?.message || 'Unknown error') });
    return res.status(400).send('Failed to update nickname: ' + (e?.message || 'Unknown error'));
  }
});

// --- Start servers (with port fallback) ---
function startWithFallback() {
  console.log('[boot] startWithFallback called');
  const first = Number(process.env.PORT || 3000);
  const candidates = [first, 3001, 3002, 3003];
  const host = process.env.HOST || '127.0.0.1';
  let idx = 0;
  let server;
  const tryNext = () => {
    const p = candidates[idx++];
    if (p == null) {
      console.error('No available ports. Tried:', candidates.join(', '));
      process.exit(1);
    }
    console.log(`[boot] trying listen on ${host}:${p}`);
    server = app
      .listen(p, host, () => {
        const url = process.env.PUBLIC_BASE_URL || `http://${host}:${p}`;
        console.log(`Dashboard/Webhooks listening on :${p} — ${url}`);
        // Start Discord client features after we have the web server up
        if (process.env.DISCORD_TOKEN) {
          client.login(process.env.DISCORD_TOKEN);
          startLiveWatchers();
          musicInit();
        } else {
          console.log('DISCORD_TOKEN not set — skipping Discord client login and related initializations. Server will run in limited mode.');
        }
        // Initialize optional MySQL sink now
        try{ if (mysqlEnabled()) { initMySql().then(()=>console.log('[mysql] initialized')); } }catch(e){ console.warn('[mysql] disabled:', e?.message||e); }
      })
      .on('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
          console.warn(`Port ${p} in use, trying next...`);
          tryNext();
        } else {
          console.error('Failed to start server:', err);
          process.exit(1);
        }
      });
  };
  tryNext();
}

startWithFallback();

// Logs page
app.get('/logs', requireLogin, async (req, res) => {
  const type = req.query.type || null; // e.g. 'dashboard','warnings','moderation','automod','commands'
  const guildId = req.query.guild_id || null;
  const page = Math.max(1, parseInt(req.query.page||'1',10));
  const perPage = Math.max(10, Math.min(200, parseInt(req.query.perPage||'20',10)));
  const offset = (page-1)*perPage;

  // Build query with optional filters
  let logs = [];
  let total = 0;
  try{
    if (guildId) {
      // Filter by guild (and type if provided)
      if (type) {
        logs = db.prepare('SELECT * FROM web_logs WHERE guild_id=? AND action_type=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(guildId, type, perPage, offset);
        total = db.prepare('SELECT COUNT(*) as c FROM web_logs WHERE guild_id=? AND action_type=?').get(guildId, type).c;
      } else {
        logs = db.prepare('SELECT * FROM web_logs WHERE guild_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(guildId, perPage, offset);
        total = db.prepare('SELECT COUNT(*) as c FROM web_logs WHERE guild_id=?').get(guildId).c;
      }
    } else {
      // No guild filter; use type-wide helpers
      logs = getWebLogsByType(type, perPage, offset);
      total = getWebLogsCountByType(type);
    }
  }catch(e){ logs = []; total = 0; }

  // If guildId provided, prettify actions: friendly mapping + channel names
  if (guildId) {
    try{
      const guild = await client.guilds.fetch(guildId).catch(()=>null);
      if (guild) { try { await guild.channels.fetch(); } catch(e){} }
      const friendly = (a='') => {
        const s = String(a||'');
        let m;
        m = s.match(/^Saved welcome settings \(enabled=([^,]+),\s*channel=([^\)]+)\)/i);
        if(m){ const en=m[1]; const ch=m[2]; return (ch && ch!=='none') ? `Changed welcome.channel setting: ${ch}` : `Changed welcome.enabled setting: ${en==='1'?'true':en}`; }
        m = s.match(/^Saved Welcome Channel \(enabled=([^,]+),\s*channel=([^\)]+)\)/i);
        if(m){ const en=m[1]; const ch=m[2]; return (ch && ch!=='none') ? `Changed welcome.channel setting: ${ch}` : `Changed welcome.enabled setting: ${en==='1'?'true':en}`; }
        m = s.match(/^(Enabled|Disabled) module:\s*([a-z0-9_\-]+)/i);
        if(m){ const en = m[1].toLowerCase()==='enabled'; const key=m[2]; return `Changed ${key}.enabled setting: ${en?'true':'false'}`; }
        m = s.match(/^Changed nickname to\s+(.+)$/i);
        if(m){ return `Name updated to ${m[1]}`; }
        m = s.match(/^Updated bot nickname to\s+\"([^\"]*)\"/i);
        if(m){ return `Name updated to ${m[1]||'(none)'}`; }
        m = s.match(/^Changed welcome\.type setting:\s*(.*)$/i);
        if(m){ return `Changed welcome.type setting: ${m[1]}`; }
        return s;
      };
      const replaceChannelIds = (text='') => {
        try{
          if (!guild) return text;
          const re = /\b\d{16,22}\b/g;
          return String(text).replace(re, (id)=>{
            const ch = guild.channels?.cache?.get?.(id);
            return ch && ch.name ? ('#' + ch.name) : id;
          });
        }catch(e){ return text; }
      };
      logs = logs.map(l => ({ ...l, action: replaceChannelIds(friendly(l.action || '')) }));
    }catch(e){}
  }

  if(String(req.query.ajax||'0')==='1'){
    return res.json({ logs, page, perPage, total, type, guildId });
  }
  return res.type('html').send(renderLogs({ logs, page, perPage, total, type, guildId }));
});

// Run a backfill to populate action_type for historical logs (manual trigger)
app.post('/logs/backfill', requireLogin, async (req, res) => {
  const changed = backfillWebLogTypes();
  return res.type('json').send({ changed });
});

// --- Leveling: award XP on messages with cooldown ---
const __xpCooldown = new Map(); // key: guild:user -> timestamp
client.on('messageCreate', async (msg) => {
  try{
    if(!msg.guild || msg.author?.bot) return;
    const key = msg.guild.id + ':' + msg.author.id;
    const now = Date.now();
    const last = __xpCooldown.get(key) || 0;
    if(now - last < 45_000) return; // 45s per-user cooldown
    __xpCooldown.set(key, now);
    const { addXp } = await import('./lib/db.js');
    const res = addXp(msg.guild.id, msg.author.id, 10 + Math.floor(Math.random()*11));
    if(res.leveledUp){
      try{ await msg.channel.send({ content: `🎉 <@${msg.author.id}> leveled up to ${res.level}!` }); }catch{}
    }
  }catch(_){ }
});
