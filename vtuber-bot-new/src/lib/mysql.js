import mysql from 'mysql2/promise';

let pool = null;

export function mysqlEnabled(){
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  return !!(MYSQL_HOST && MYSQL_USER && (MYSQL_PASSWORD || MYSQL_PASSWORD === '') && MYSQL_DATABASE);
}

export async function initMySql(){
  if(!mysqlEnabled()) return null;
  if(pool) return pool;
  const host = process.env.MYSQL_HOST;
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE;
  const ssl = (()=>{
    const v = (process.env.MYSQL_SSL||'').toLowerCase();
    if(v==='true' || v==='1') return { rejectUnauthorized: false };
    return undefined;
  })();
  pool = mysql.createPool({ host, port, user, password, database, ssl, connectionLimit: 5, charset: 'utf8mb4_general_ci' });
  try{
    const conn = await pool.getConnection();
    try{
      // Ensure table exists
      await conn.query(`
        CREATE TABLE IF NOT EXISTS web_logs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          guild_id VARCHAR(32) NULL,
          user_id VARCHAR(32) NULL,
          username VARCHAR(64) NULL,
          action TEXT NOT NULL,
          action_type VARCHAR(32) NULL,
          created_at BIGINT NOT NULL,
          PRIMARY KEY (id),
          INDEX idx_guild_created (guild_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } finally {
      conn.release();
    }
  }catch(e){
    // If init fails, disable MySQL silently to avoid breaking the app
    console.warn('[mysql] init failed:', e?.message || e);
    try{ await pool.end(); }catch{}
    pool = null;
  }
  return pool;
}

export async function mysqlInsertWebLog({ guild_id=null, user_id=null, username=null, action='', action_type=null, created_at=Date.now() }){
  if(!pool) return;
  try{
    await pool.execute(
      'INSERT INTO web_logs (guild_id, user_id, username, action, action_type, created_at) VALUES (?,?,?,?,?,?)',
      [guild_id, user_id, username, action, action_type, created_at]
    );
  }catch(e){
    // swallow to avoid impacting primary flow
  }
}

export function getMySqlPool(){ return pool; }
