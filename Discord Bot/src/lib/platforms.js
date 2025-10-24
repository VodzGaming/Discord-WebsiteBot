export async function resolveTwitchLogin(input){
  const login = String(input).trim().replace(/^@/, '').toLowerCase();
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) return { login };
  const tok = await (await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_CLIENT_ID}&client_secret=${process.env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' })).json();
  const access = tok.access_token; if (!access) return { login };
  const data = await (await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`, { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID, 'Authorization': `Bearer ${access}` } })).json();
  const u = (data.data||[])[0]; if (!u) return { login }; return { login: u.login, display_name: u.display_name, user_id: u.id };
}
export async function resolveYouTubeChannel(input){
  const key = process.env.YOUTUBE_API_KEY; let val = String(input).trim();
  if (/^UC[0-9A-Za-z_-]{22}$/.test(val)) return { channel_id: val };
  try{
    if (/^https?:\/\//i.test(val)){
      const u = new URL(val); const p = u.pathname.replace(/\/$/, ''); const parts = p.split('/').filter(Boolean);
      if (parts[0]==='channel' && /^UC/.test(parts[1])) return { channel_id: parts[1] };
      if (parts[0].startsWith('@')) val = parts[0]; else if (parts[0]==='c' || parts[0]==='user') val = parts[1];
    }
    if (val.startsWith('@')) val = val.slice(1);
  }catch{}
  if (!key) return null;
  const q = encodeURIComponent(val);
  const data = await (await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=1&q=${q}&key=${key}`)).json();
  const item = (data.items||[])[0]; if (!item) return null;
  return { channel_id: item.id?.channelId, display_name: item.snippet?.title };
}
