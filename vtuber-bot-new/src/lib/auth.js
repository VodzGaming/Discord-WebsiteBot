import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';

const SQLiteStore = SQLiteStoreFactory(session);

export function setupAuth(app){
  app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000*60*60*24*7 }
  }));

  function getBase(req){
    // In dev, always use the live request's host:port to avoid mismatch
    if (process.env.DEV_MODE === '1') {
      const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString();
      const host = req.get('host');
      return `${proto}://${host}`;
    }
    // Otherwise prefer explicit config, else derive from current request
    const configured = process.env.PUBLIC_BASE_URL;
    if (configured && configured.trim()) return configured.trim();
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString();
    const host = req.get('host');
    return `${proto}://${host}`;
  }

  app.get('/login', (req, res) => {
    const base = getBase(req);
    const redirect = (process.env.DEV_MODE === '1' ? (base + '/oauth/callback') : (process.env.OAUTH_REDIRECT_URI || (base + '/oauth/callback')));
    const params = new URLSearchParams({
      client_id: process.env.OAUTH_CLIENT_ID || process.env.CLIENT_ID,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'identify guilds',
      prompt: 'consent',
      state: Math.random().toString(36).slice(2)
    });
    console.log('OAuth login redirect_uri =>', redirect);
    req.session.oauth_state = params.get('state');
    res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString());
  });

  // Development-only helper login to bypass OAuth when DEV_MODE=1.
  // Use: /dev-login?guild_id=123&next=/dashboard?guild_id=123
  if (process.env.DEV_MODE === '1') {
    console.log('DEV_MODE=1 — /dev-login helper route is ENABLED');
    app.get('/dev-login', (req, res) => {
      const gid = req.query.guild_id || '000000000000000000';
      req.session.user = { id: 'dev-user', username: 'dev' };
      req.session.guilds = [ { id: gid, owner: true, permissions: '0' } ];
      req.session.guildsManageable = [ { id: gid, owner: true, permissions: '0' } ];
      const next = req.query.next || '/';
      res.redirect(next);
    });
  }

  app.get('/oauth/callback', async (req, res) => {
    try{
      if (!req.query.code) return res.status(400).send('No code');
      if (req.session.oauth_state && req.query.state !== req.session.oauth_state) return res.status(400).send('Bad state');

      const base = getBase(req);
      const body = new URLSearchParams({
        client_id: process.env.OAUTH_CLIENT_ID || process.env.CLIENT_ID,
        client_secret: process.env.OAUTH_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: (process.env.DEV_MODE === '1' ? (base + '/oauth/callback') : (process.env.OAUTH_REDIRECT_URI || (base + '/oauth/callback')))
      });
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', { method:'POST', headers:{ 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const token = await tokenRes.json();
      if (!token.access_token) return res.status(400).send('Token exchange failed');

      const headers = { Authorization: `Bearer ${token.access_token}` };
      const user = await (await fetch('https://discord.com/api/users/@me', { headers })).json();
      const guilds = await (await fetch('https://discord.com/api/users/@me/guilds', { headers })).json();

      const MANAGE_GUILD = 1n << 5n; const ADMIN = 1n << 3n;
      const guildsManageable = (guilds||[]).filter(g => {
        if (g.owner) return true;
        try{ const p = BigInt(g.permissions); return (p & (MANAGE_GUILD|ADMIN)) !== 0n; }catch{ return false; }
      });

      req.session.user = user;
      req.session.guilds = guilds;
      req.session.guildsManageable = guildsManageable;
      req.session.token = token;

      res.redirect('/servers');
    }catch(e){ console.error(e); res.status(500).send('OAuth error'); }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(()=>{});
    res.redirect('/');
  });
}

export function requireLogin(req, res, next){
  if (req.session && req.session.user) return next();
  res.redirect('/login');
}

export function userCanManageGuild(req, guildId){
  const list = req.session.guildsManageable || [];
  return list.some(g => String(g.id) === String(guildId));
}
