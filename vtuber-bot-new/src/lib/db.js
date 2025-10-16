import Database from 'better-sqlite3';
import { mysqlEnabled, initMySql, mysqlInsertWebLog } from './mysql.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '../../data.sqlite');

export const db = new Database(DB_PATH);

export function initDb(){
  db.pragma('journal_mode = wal');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_streams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      display_name TEXT,
      announce_channel_id TEXT,
      mention_everyone INTEGER DEFAULT 0,
      last_live_status INTEGER DEFAULT 0,
      last_announcement_at INTEGER,
      UNIQUE(guild_id, platform, channel_id)
    );

    CREATE TABLE IF NOT EXISTS reaction_menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reaction_menu_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_id INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      emoji TEXT,
      label TEXT,
      FOREIGN KEY(menu_id) REFERENCES reaction_menus(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      open INTEGER DEFAULT 1,
      created_at INTEGER
    );

    -- Welcome module settings
    CREATE TABLE IF NOT EXISTS welcome_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      channel_id TEXT,
      message_type TEXT DEFAULT 'message',
      message_text TEXT
    );

    -- Module enable/disable state for dashboard cards
    CREATE TABLE IF NOT EXISTS module_state (
      guild_id TEXT NOT NULL,
      module TEXT NOT NULL,
      enabled INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, module)
    );
    
    -- Web dashboard logs (actions taken in the web UI)
    CREATE TABLE IF NOT EXISTS web_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT,
      user_id TEXT,
      username TEXT,
      action TEXT,
      action_type TEXT,
      created_at INTEGER
    );

    -- Bot settings per guild
    CREATE TABLE IF NOT EXISTS bot_settings (
      guild_id TEXT PRIMARY KEY,
      prefix TEXT DEFAULT '?',
      updates_channel_id TEXT,
      timezone TEXT
    );

    -- Manager roles per guild (roles with elevated permissions allowed to manage the bot)
    CREATE TABLE IF NOT EXISTS bot_manager_roles (
      guild_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, role_id)
    );
  `);

  // Migration: add emoji column to reaction_menu_roles if missing
  try{ db.prepare('ALTER TABLE reaction_menu_roles ADD COLUMN emoji TEXT').run(); }catch(e){}

  // Migrate welcome_settings: add columns if missing (SQLite doesn't support IF NOT EXISTS on ALTER)
  try {
    db.prepare("ALTER TABLE welcome_settings ADD COLUMN last_message_id TEXT").run();
  } catch(e) {/* ignore if column exists */}
  try {
    db.prepare("ALTER TABLE welcome_settings ADD COLUMN last_sent_at INTEGER").run();
  } catch(e) {/* ignore if column exists */}
  // Add embed_json to welcome_settings if missing
  try {
    db.prepare("ALTER TABLE welcome_settings ADD COLUMN embed_json TEXT").run();
  } catch(e) {/* ignore if column exists */}
  // Persist a preferred bot nickname per guild for previews and defaults
  try {
    db.prepare("ALTER TABLE welcome_settings ADD COLUMN bot_nickname TEXT").run();
  } catch(e) {/* ignore if column exists */}
  // Add custom_image_json to welcome_settings if missing (for Welcome Banner mode)
  try {
    db.prepare("ALTER TABLE welcome_settings ADD COLUMN custom_image_json TEXT").run();
  } catch(e) {/* ignore if column exists */}
  // Add action_type to web_logs if missing
  try {
    db.prepare("ALTER TABLE web_logs ADD COLUMN action_type TEXT").run();
  } catch(e) {/* ignore if column exists */}
  // Backfill existing rows to set action_type heuristically (safe, idempotent)
  try{
    const changed = backfillWebLogTypes();
    if(changed) console.log(`Backfilled web_logs action_type for ${changed} rows`);
  }catch(e){}
  // Add metadata columns to reaction_menus if missing
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN name TEXT').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN selection_type TEXT').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN message_type TEXT').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN title TEXT').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN embed_json TEXT').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN allow_multi INTEGER').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN reverse_mode INTEGER').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN allowed_roles TEXT').run(); }catch(e){}
  try{ db.prepare('ALTER TABLE reaction_menus ADD COLUMN ignored_roles TEXT').run(); }catch(e){}
}

// Web logs: simple table to store dashboard actions
export function addWebLog({ guild_id=null, user_id=null, username=null, action='', action_type=null }){
  // try to set action_type if provided; fallback to NULL
  const payload = { guild_id, user_id, username, action, action_type, created_at: Date.now() };
  db.prepare(`INSERT INTO web_logs (guild_id, user_id, username, action, action_type, created_at) VALUES (@guild_id,@user_id,@username,@action,@action_type,@created_at)`).run(payload);
  // fire-and-forget mirror to MySQL if enabled
  try{ if (mysqlEnabled()) { mysqlInsertWebLog(payload); } }catch(e){}
}

// Note: getWebLogs is defined earlier above (kept there). Do not redeclare.

export function getWebLogsByType(type=null, limit=200, offset=0){
  if(!type) return getWebLogs(limit, offset);
  return db.prepare('SELECT * FROM web_logs WHERE action_type=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(type, limit, offset);
}

export function getWebLogsCountByType(type=null){
  if(!type) return db.prepare('SELECT COUNT(*) as c FROM web_logs').get().c;
  return db.prepare('SELECT COUNT(*) as c FROM web_logs WHERE action_type=?').get(type).c;
}

// Backfill heuristic to populate action_type for historical rows
export function backfillWebLogTypes(){
  // Examples: welcome -> dashboard, warn -> warnings, ban/kick -> moderation, automod -> automod, command -> commands
  const rows = db.prepare('SELECT id, action FROM web_logs WHERE action_type IS NULL OR action_type = ""').all();
  const upd = db.prepare('UPDATE web_logs SET action_type=@action_type WHERE id=@id');
  for(const r of rows){
    const a = (r.action||'').toLowerCase();
    let t = null;
    if(/welcome|changed welcome|welcome\./.test(a)) t = 'dashboard';
    else if(/warn|warning/.test(a)) t = 'warnings';
    else if(/ban|kick|moderat|mute|unmute/.test(a)) t = 'moderation';
    else if(/automod|auto[- ]?mod/.test(a)) t = 'automod';
    else if(/command|slash command|ran command/.test(a)) t = 'commands';
    if(t) upd.run({ action_type: t, id: r.id });
  }
  return rows.length;
}

export function getWebLogs(limit=200, offset=0){
  return db.prepare('SELECT * FROM web_logs ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
}

// Recent logs per guild (most recent first)
export function getWebLogsForGuild(guildId, limit=10, offset=0){
  return db.prepare('SELECT * FROM web_logs WHERE guild_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(guildId, limit, offset);
}


// Helper: get a map of module -> enabled for a guild
export function getModuleStates(guildId){
  const rows = db.prepare('SELECT module, enabled FROM module_state WHERE guild_id=?').all(guildId);
  const map = {};
  for(const r of rows) map[r.module] = !!r.enabled;
  return map;
}

// Helper: set module enabled/disabled
export function setModuleState(guildId, module, enabled){
  db.prepare(`INSERT INTO module_state (guild_id, module, enabled) VALUES (@guild_id,@module,@enabled)
              ON CONFLICT(guild_id,module) DO UPDATE SET enabled=@enabled`).run({ guild_id: guildId, module, enabled: enabled ? 1 : 0 });
}

// Quick check for a module toggle (returns boolean)
export function isModuleEnabled(guildId, module){
  try{
    const row = db.prepare('SELECT enabled FROM module_state WHERE guild_id=? AND module=?').get(guildId, module);
    return !!(row && row.enabled);
  }catch(e){ return false; }
}

// ---- Bot settings helpers ----
export function getBotSettings(guildId){
  const row = db.prepare('SELECT * FROM bot_settings WHERE guild_id=?').get(guildId);
  return row || { guild_id: guildId, prefix: '?', updates_channel_id: null, timezone: null };
}

export function setBotSettings({ guild_id, prefix, updates_channel_id, timezone }){
  db.prepare(`INSERT INTO bot_settings (guild_id, prefix, updates_channel_id, timezone)
              VALUES (@guild_id,@prefix,@updates_channel_id,@timezone)
              ON CONFLICT(guild_id) DO UPDATE SET prefix=@prefix, updates_channel_id=@updates_channel_id, timezone=@timezone`)
    .run({ guild_id, prefix, updates_channel_id, timezone });
}

// ---- Manager roles helpers ----
export function getManagerRoles(guildId){
  return db.prepare('SELECT role_id FROM bot_manager_roles WHERE guild_id=?').all(guildId).map(r=>r.role_id);
}

export function setManagerRoles(guildId, roleIds){
  const del = db.prepare('DELETE FROM bot_manager_roles WHERE guild_id=?');
  const ins = db.prepare('INSERT INTO bot_manager_roles (guild_id, role_id) VALUES (?, ?)');
  const trx = db.transaction((ids)=>{
    del.run(guildId);
    for(const id of ids){ ins.run(guildId, id); }
  });
  trx(roleIds || []);
}

// ---- Reaction roles helpers ----
export function addReactionMenu({ guild_id, channel_id, message_id, roles=[], name=null, selection_type=null, message_type=null, title=null, embed_json=null, allow_multi=0, reverse_mode=0, allowed_roles=null, ignored_roles=null }){
  const insMenu = db.prepare('INSERT INTO reaction_menus (guild_id, channel_id, message_id) VALUES (?, ?, ?)');
  const insRole = db.prepare('INSERT INTO reaction_menu_roles (menu_id, role_id, emoji, label) VALUES (?, ?, ?, ?)');
  const trx = db.transaction(()=>{
    const r = insMenu.run(guild_id, channel_id, message_id);
    const menuId = r.lastInsertRowid;
    for(const entry of roles){
      const rid = (entry && entry.role_id) || entry?.id || entry; const lbl = (entry && entry.label) || null; const emo = (entry && (entry.emoji||entry.emo)) || null;
      if(rid) insRole.run(menuId, String(rid), emo || null, lbl);
    }
    // Update metadata after insert to avoid column mismatch across versions
    const upd = db.prepare(`UPDATE reaction_menus SET name=@name, selection_type=@selection_type, message_type=@message_type, title=@title, embed_json=@embed_json, allow_multi=@allow_multi, reverse_mode=@reverse_mode, allowed_roles=@allowed_roles, ignored_roles=@ignored_roles WHERE id=@id`);
    upd.run({ id: menuId, name, selection_type, message_type, title, embed_json, allow_multi: allow_multi?1:0, reverse_mode: reverse_mode?1:0, allowed_roles, ignored_roles });
    return menuId;
  });
  return trx();
}

export function getReactionMenus(guild_id){
  const menus = db.prepare('SELECT * FROM reaction_menus WHERE guild_id=? ORDER BY id DESC').all(guild_id);
  if(!menus.length) return [];
  const rolesBy = new Map();
  const q = 'SELECT * FROM reaction_menu_roles WHERE menu_id IN (' + menus.map(()=>'?').join(',') + ')';
  const rows = db.prepare(q).all(...menus.map(m=>m.id));
  for(const r of rows){ if(!rolesBy.has(r.menu_id)) rolesBy.set(r.menu_id, []); rolesBy.get(r.menu_id).push(r); }
  return menus.map(m=> ({ ...m, roles: rolesBy.get(m.id) || [] }));
}

export function deleteReactionMenu(menu_id){
  const delRoles = db.prepare('DELETE FROM reaction_menu_roles WHERE menu_id=?');
  const delMenu = db.prepare('DELETE FROM reaction_menus WHERE id=?');
  const trx = db.transaction(()=>{ delRoles.run(menu_id); delMenu.run(menu_id); });
  trx();
}

export function getReactionMenuByMessageId(message_id){
  const menu = db.prepare('SELECT * FROM reaction_menus WHERE message_id=?').get(message_id);
  if(!menu) return null;
  const roles = db.prepare('SELECT * FROM reaction_menu_roles WHERE menu_id=?').all(menu.id);
  return { ...menu, roles };
}

// Get a reaction menu by its primary id, including roles
export function getReactionMenuById(menu_id){
  const m = db.prepare('SELECT * FROM reaction_menus WHERE id=?').get(menu_id);
  if(!m) return null;
  const roles = db.prepare('SELECT * FROM reaction_menu_roles WHERE menu_id=?').all(menu_id);
  return { ...m, roles };
}
