import { modulesList } from '../lib/modules.js';

export const layout = (title, body, opts={}) => {
  const guildId = opts.guildId || '';
  const modulesHtml = modulesList.map(m=>`<a class="sb-item" href="${guildId?m.href(guildId):'#'}">${m.name}</a>`).join('\n');
  const dashHref = `/dashboard${guildId?`?guild_id=${guildId}`:''}`;
  const modsHref = `/modules${guildId?`?guild_id=${guildId}`:''}`;
  const inviteHref = `/invite?perms=8&scopes=bot%20applications.commands${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}`;
  const recommendedPerms = [
    0x00000040, /* Add Reactions */
    0x00000400, /* View Channel */
    0x00000800, /* Send Messages */
    0x00004000, /* Embed Links */
    0x00008000, /* Attach Files */
    0x00010000, /* Read Message History */
    0x00040000, /* Use External Emojis */
    0x10000000  /* Manage Roles */
  ].reduce((a,b)=>a+b,0);
  const inviteHrefRec = `/invite?perms=${recommendedPerms}&scopes=bot%20applications.commands${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    :root{
      color-scheme: dark light;
      --antd-wave-shadow-color: #177ddc;
      --scroll-bar: 0;
      --animate-duration: 1s;
      --animate-delay: 1s;
      --animate-repeat: 1;
      --tude-video-bg: rgba(0, 0, 0, 0.025);
      --tude-video-border-radius: 9px;
      --tude-video-controlbar-padding: 10px;
      --tude-video-controlbar-padding-bottom: var(--tude-video-controlbar-padding);
      --tude-video-controls-icon-spacing: 4px;
      --tude-video-controls-icon-padding: 4px;
      --tude-video-controls-icon-size: 13px;
      --tude-video-controls-icon-bg: rgba(0, 0, 0, .8);
      --tude-video-controls-icon-color: white;
      --tude-video-controls-icon-border-radius: 100px;
      --tude-video-controls-progress-bg: rgba(255, 255, 255, .2);
      --tude-video-controls-progress-color: rgb(9 150 9);
      --tude-video-controls-play-icon: url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M405.2,232.9L126.8,67.2c-3.4-2-6.9-3.2-10.9-3.2c-10.9,0-19.8,9-19.8,20H96v344h0.1c0,11,8.9,20,19.8,20  c4.1,0,7.5-1.4,11.2-3.4l278.1-165.5c6.6-5.5,10.8-13.8,10.8-23.1C416,246.7,411.8,238.5,405.2,232.9z\"/></svg>");
      --tude-video-controls-pause-icon: url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\"><path d=\"M216,48V208a16,16,0,0,1-16,16H164a16,16,0,0,1-16-16V48a16,16,0,0,1,16-16h36A16,16,0,0,1,216,48ZM92,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H92a16,16,0,0,0,16-16V48A16,16,0,0,0,92,32Z\"/></svg>");
      --tude-video-controls-mute-icon: url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path style=\"fill:none;stroke:black;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px\" d=\"M416 432 64 80\"/><path d=\"M243.33 98.86a23.89 23.89 0 0 0-25.55 1.82l-.66.51-28.52 23.35a8 8 0 0 0-.59 11.85l54.33 54.33a8 8 0 0 0 13.66-5.66v-64.49a24.51 24.51 0 0 0-12.67-21.71Zm8 236.43L96.69 180.69A16 16 0 0 0 85.38 176H56a24 24 0 0 0-24 24v112a24 24 0 0 0 24 24h69.76l92 75.31a23.9 23.9 0 0 0 25.87 1.69A24.51 24.51 0 0 0 256 391.45v-44.86a16 16 0 0 0-4.67-11.3ZM352 256c0-24.56-5.81-47.87-17.75-71.27a16 16 0 1 0-28.5 14.55C315.34 218.06 320 236.62 320 256q0 4-.31 8.13a8 8 0 0 0 2.32 6.25l14.36 14.36a8 8 0 0 0 13.55-4.31A146 146 0 0 0 352 256Zm64 0c0-51.18-13.08-83.89-34.18-120.06a16 16 0 0 0-27.64 16.12C373.07 184.44 384 211.83 384 256c0 23.83-3.29 42.88-9.37 60.65a8 8 0 0 0 1.9 8.26L389 337.4a8 8 0 0 0 13.13-2.79C411 311.76 416 287.26 416 256Z\"/><path d=\"M480 256c0-74.25-20.19-121.11-50.51-168.61a16 16 0 1 0-27 17.22C429.82 147.38 448 189.5 448 256c0 46.19-8.43 80.27-22.43 110.53a8 8 0 0 0 1.59 9l11.92 11.92a8 8 0 0 0 12.92-2.16C471.6 344.9 480 305 480 256Z\"/></svg>");
      --tude-video-controls-unmute-icon: url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M232,416a23.88,23.88,0,0,1-14.2-4.68,8.27,8.27,0,0,1-.66-.51L125.76,336H56a24,24,0,0,1-24-24V200a24,24,0,0,1,24-24h69.75l91.37-74.81a8.27,8.27,0,0,1,.66-.51A24,24,0,0,1,256,120V392a24,24,0,0,1-24,24ZM125.82,336Zm-.27-159.86Z\"/><path d=\"M320,336a16,16,0,0,1-14.29-23.19c9.49-18.87,14.3-38,14.3-56.81,0-19.38-4.66-37.94-14.25-56.73a16,16,0,0,1,28.5-14.54C346.19,208.12,352,231.44,352,256c0,23.86-6,47.81-17.7,71.19A16,16,0,0,1,320,336Z\"/><path d=\"M368,384a16,16,0,0,1-13.86-24C373.05,327.09,384,299.51,384,256c0-44.17-10.93-71.56-29.82-103.94a16,16,0,0,1,27.64-16.12C402.92,172.11,416,204.81,416,256c0,50.43-13.06,83.29-34.13,120A16,16,0,0,1,368,384Z\"/><path d=\"M416,432a16,16,0,0,1-13.39-24.74C429.85,365.47,448,323.76,448,256c0-66.5-18.18-108.62-45.49-151.39a16,16,0,1,1,27-17.22C459.81,134.89,480,181.74,480,256c0,64.75-14.66,113.63-50.6,168.74A16,16,0,0,1,416,432Z\"/></svg>");
      --tude-video-controls-close-icon: url("data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><path d=\"M443.6,387.1L312.4,255.4l131.5-130c5.4-5.4,5.4-14.2,0-19.6l-37.4-37.6c-2.6-2.6-6.1-4-9.8-4c-3.7,0-7.2,1.5-9.8,4  L256,197.8L124.9,68.3c-2.6-2.6-6.1-4-9.8-4c-3.7,0-7.2,1.5-9.8,4L68,105.9c-5.4,5.4-5.4,14.2,0,19.6l131.5,130L68.4,387.1  c-2.6,2.6-4.1,6.1-4.1,9.8c0,3.7,1.4,7.2,4.1,9.8l37.4,37.6c2.7,2.7,6.2,4.1,9.8,4.1c3.5,0,7.1-1.3,9.8-4.1L256,313.1l130.7,131.1  c2.7,2.7,6.2,4.1,9.8,4.1c3.5,0,7.1-1.3,9.8-4.1l37.4-37.6c2.6-2.6,4.1-6.1,4.1-9.8C447.7,393.2,446.2,389.7,443.6,387.1z\"/></svg>");
      --tude-video-controls-close-inset: auto var(--tude-video-controlbar-padding) var(--tude-video-controlbar-padding-bottom) auto;
      --tude-video-controls-close-transform: none;
    }
    *{ box-sizing: border-box }
    html,body{ height:100% }
    body{
      margin:0;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  text-size-adjust: 100%;
  font-family: "Inter", Arial, Helvetica, sans-serif;
  font-size: 14px;
  line-height: 1.5;
      /* Simplify to a flat background to remove color overlays under panels */
      background: #0b0e14;
      color:#e8eaf0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    a{ color:inherit }
  /* expanded container to match Dyno reference widths (used in header) */
  .wrap{ max-width:2148.87px; margin:0 auto; padding:18px 18px }
    header{
      position:sticky; top:0; z-index:20;
      backdrop-filter: blur(10px);
      background: rgba(15,18,26,.55);
      border-bottom:1px solid rgba(255,255,255,.06);
    }
  .bar{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; }
    .brand{ display:flex; align-items:center; gap:10px; }
    .dot{ width:10px; height:10px; border-radius:50%; background:#8b5cf6; box-shadow:0 0 22px #8b5cf6aa }
    .muted{ color:#a3a7b1 }
    .btn, .btn-outline{
      display:inline-flex; align-items:center; gap:8px;
      border-radius:12px; padding:10px 14px; text-decoration:none; font-weight:600; transition:.18s transform, .18s filter, .18s border-color;
    }
    .btn{ background:#8b5cf6; color:white; box-shadow:0 10px 30px -12px #8b5cf6cc }
    .btn:hover{ filter:brightness(1.08); transform: translateY(-1px); }
    .btn-outline{ border:1px solid #2b2d31; color:#d7d9df }
    .btn-outline:hover{ border-color:#8b5cf6; transform: translateY(-1px); }
    .hero{ padding:64px 0 26px; text-align:center }
    .hero h1{ font-size: clamp(28px, 4.2vw, 44px); line-height:1.08; margin:0 0 10px }
    .hero p{ margin:0; color:#b4b8c3 }
    .hero-cta{ margin-top:18px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap }
    .grid{ display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:14px }
    .card{
      border:1px solid rgba(255,255,255,.06);
      background: rgba(18,21,29,.55);
      border-radius:16px; padding:14px 16px; backdrop-filter: blur(6px);
      transition:.18s border-color, .18s transform, .18s background;
    }
    .card:hover{ border-color:#8b5cf6; transform: translateY(-2px); background: rgba(21,24,34,.62); }
    .icon64{ width:44px; height:44px; border-radius:12px; background:#1b2030; display:inline-flex; align-items:center; justify-content:center; font-size:22px }
    .server-card{ display:flex; align-items:center; gap:12px; padding:14px 16px; text-decoration:none; color:inherit }
    .avatar{ width:42px; height:42px; border-radius:10px; background:#1e2230; display:grid; place-items:center; font-weight:800; color:#9aa1ac; object-fit:cover }
    .tag{ display:inline-flex; padding:4px 8px; border:1px solid #2b2d31; border-radius:999px; color:#cbd0d9; font-size:12px }
    .pill{ background:#8b5cf6; color:white; border-radius:999px; padding:2px 8px; font-size:12px }
    .h-sub{ margin:16px 0 8px; color:#cdd1db }
    .section{ margin:26px 0 }
    input,select{ width:100%; padding:.6rem .7rem; border-radius:10px; border:1px solid #2b2d31; background:#0f131c; color:#e8eaf0; }
    .row{ display:grid; grid-template-columns: 1fr 1fr; gap:12px }
    @media (max-width:760px){ .row{ grid-template-columns: 1fr } }
    .tabs{ display:flex; gap:8px; border-bottom:1px solid rgba(255,255,255,.06); margin:8px 0 16px }
    .tab{ padding:10px 12px; border-radius:10px 10px 0 0; border:1px solid transparent; cursor:pointer }
    .tab.active{ border-color:#8b5cf6; border-bottom-color:transparent; background: rgba(139,92,246,.12) }
  .hide{ display:none }
  /* Title helpers to match Dyno styles */
  .title{ font-weight:800; margin:0; color:#e8eaf0 }
  .title.is-5{ font-size:16px }
  .title.is-4{ font-size:18px }
  /* Global breadcrumbs for module pages */
  .crumbs{ font-size:24px; font-weight:800 }
  .crumbs .crumb{ color:#8b5cf6; text-decoration:none }
  .crumbs .crumb:hover{ color:#a78bfa; text-decoration:underline }
  .crumbs .sep{ opacity:.5 }
  /* Basic form/button helpers for cross-compat */
  .button{ display:inline-flex; align-items:center; gap:8px; border-radius:10px; padding:10px 14px; text-decoration:none; font-weight:600; border:1px solid rgba(255,255,255,.08); background:#121622; color:#e8eaf0 }
  .button.is-info{ background:#3b82f6; border-color:#3b82f6; color:#fff }
  .label{ display:block; font-weight:700; color:#c9cbd1; margin-bottom:8px }
  .input{ width:100%; padding:.7rem .8rem; border-radius:10px; border:1px solid #2b2d31; background:#0f131c; color:#e8eaf0 }
  .checkbox{ cursor:pointer }
  /* Full-width container helpers (ensure pages like Welcome are fluid) */
  .container{ width:100%; max-width:none; margin:0; padding:0 }
  .topbar{ display:flex; align-items:center; justify-content:space-between; margin:0 0 12px }
    /* Sidebar styles */
    .main-layout{ display:flex; min-height:calc(100vh - 72px); }
  .sidebar{ width:220px; background:#0b0d12; border-right:1px solid rgba(255,255,255,.03); padding:18px 14px; color:#c9cbd1 }
    .sb-brand{ font-weight:700; display:flex; align-items:center; gap:8px; padding:6px 8px; margin-bottom:16px }
    .sb-nav{ display:flex; flex-direction:column; gap:6px }
    .sb-item{ display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; text-decoration:none; color:#d7d9df; margin-bottom:6px }
    .sb-item svg{ width:16px; height:16px; opacity:.9 }
    .sb-item:hover{ background:rgba(255,255,255,.02); color:#fff }
    .sb-item.active{ background:#14161a; border-left:4px solid #8b5cf6; color:#fff }
    .sb-sub{ margin-left:6px; margin-top:6px; display:none; flex-direction:column; gap:6px }
    .sb-sub .sb-item{ padding-left:28px; background:transparent }
    @media(max-width:900px){ .sidebar{ display:none } .main-layout{ flex-direction:column } }
  /* Make main content area fluid full-width (no centered wrap) */
  .content{ flex:1; width:100%; padding:18px 18px }
  /* Custom scrollbar (WebKit) */
  ::-webkit-scrollbar{ width:10px; height:10px }
  ::-webkit-scrollbar-track{ background: rgba(11,13,18,0.6); border-radius:8px }
  ::-webkit-scrollbar-thumb{ background: rgba(139,92,246,0.18); border-radius:8px; border:2px solid rgba(11,13,18,0.6) }
  /* Firefox */
  html{ scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.18) rgba(11,13,18,0.6) }

  /* Server Info shared styles (centralized) */
  .panel.server-info .server-avatar{ width:56px; height:56px; border-radius:8px; background:#0f1317; display:grid; place-items:center; font-weight:700; color:#9aa1ac }
  .panel.server-info .server-title{ font-weight:800; letter-spacing:.6px }
  .panel.server-info .server-subtitle{ font-weight:600; color:#98a0ab; font-size:13px }
  .panel.server-info .server-stats{ margin-top:16px }
  .panel.server-info .server-info-list{ list-style:none; padding:0; margin:0 0 10px; display:flex; flex-wrap:wrap; gap:12px; color:#e6e9ef }
  .panel.server-info .server-info-list li{ min-width:140px; color:#d1d5db; font-weight:600 }
  .panel.server-info .server-actions{ list-style:none; padding:0; margin:0; display:flex; gap:12px }
  .panel.server-info .server-actions a{ text-decoration:none; padding:8px 10px; border-radius:8px }
  .panel.server-info .server-actions a:hover{ filter:brightness(1.06) }
  /* Support "ul.server-info" class from reference markup */
  .settings-content ul.server-info{ list-style:none; padding:0; margin:0 0 10px; display:flex; flex-wrap:wrap; gap:12px; color:#e6e9ef }
  .settings-content ul.server-info li{ min-width:140px; color:#d1d5db; font-weight:600 }
  .settings-content ul.server-info li a{ text-decoration:none; padding:8px 10px; border-radius:8px }
  .settings-content ul.server-info li a:hover{ filter:brightness(1.06) }
  /* Page header and utilities */
  .page-header{ display:flex; gap:16px; align-items:center; margin-bottom:14px }
  .header-title{ font-weight:800; font-size:20px }
  .header-cta{ margin-left:auto }
  .server-stats-row{ display:flex; gap:16px; align-items:flex-start; margin-top:6px }
  .settings-content{ margin:0; width:100% }
  .preview-avatar.small{ width:64px; height:64px; border-radius:8px; overflow:hidden }
  </style>
</head>
<body>
  <header>
    <div class="bar wrap" style="padding-left:0;padding-right:0">
      <div class="brand"><span class="dot"></span><strong>Vtuber Bot</strong><span class="muted" style="font-weight:500">starter</span></div>
      <nav style="display:flex; gap:10px; flex-wrap:wrap">
        <a class="btn-outline" href="/">Home</a>
    <a class="btn-outline" href="/servers">Manage Servers</a>
  <a class="btn-outline" href="${inviteHref}" id="open-invite">Invite (Admin)</a>
  <a class="btn-outline" href="${inviteHrefRec}" id="open-invite-rec">Invite (Recommended)</a>
        <a class="btn-outline" href="/logout">Log out</a>
      </nav>
    </div>
  </header>

  <div class="main-layout">
  <aside class="sidebar">
      <div class="sb-brand">⚒️<span style="margin-left:8px;font-weight:700">The Forge</span></div>
      <nav class="sb-nav">
  <a class="sb-item" data-target="/dashboard" href="${dashHref}"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" fill="#8b5cf6"/></svg>Dashboard</a>
  <a class="sb-item sb-modules" href="${modsHref}" data-toggle="modules"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" fill="#e76f51"/></svg>Modules</a>
        <div class="sb-sub" id="modules-sub">
          ${modulesHtml}
        </div>
        <a class="sb-item" data-target="/commands" href="/commands"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="#6ee7b7" stroke-width="1.5" stroke-linecap="round"/></svg>Commands</a>
  <a class="sb-item" data-target="/servers" href="${guildId?`/dashboard/guild/${guildId}/listing`:'/servers'}"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#60a5fa" stroke-width="1.5"/></svg>Server Listing</a>
        <a class="sb-item" data-target="/logs" href="/logs"><svg viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h8" stroke="#f97316" stroke-width="1.5" stroke-linecap="round"/></svg>Logs</a>
      </nav>
    </aside>

    <main class="content">
      ${body}
    </main>
  </div>
  <script>
    // highlight active sidebar item and toggle modules submenu
    (function(){
      try{
        const path = window.location.pathname + (window.location.search||'');
        document.querySelectorAll('.sb-item[data-target]').forEach(a=>{
          const t = a.getAttribute('data-target');
          if(path.indexOf(t)===0) a.classList.add('active');
        });
        // Modules submenu: auto-open on modules pages or when a guild is active; clicking the Modules link will navigate to the grid for the selected guild
        const modBtn = document.querySelector('.sb-modules');
        const modSub = document.getElementById('modules-sub');
        if(modSub){
          const onMods = path.startsWith('/modules');
          const hasGuild = ${JSON.stringify(!!opts.guildId)};
          modSub.style.display = (onMods || hasGuild) ? 'flex' : 'none';
        }
      }catch(e){}
    })();

    // One-click invite popups (Admin and Recommended)
    (function(){
      const link = document.getElementById('open-invite');
      const linkRec = document.getElementById('open-invite-rec');
      const hasClientId = ${JSON.stringify(!!(process.env.OAUTH_CLIENT_ID || process.env.CLIENT_ID))};
      function openPopupFor(href){
        const u = href;
        const w = 720, h = 900;
        const y = (window.top?.outerHeight||h)/2 + (window.top?.screenY||0) - (h/2);
        const x = (window.top?.outerWidth||w)/2 + (window.top?.screenX||0) - (w/2);
        window.open(u, 'invite', 'width='+w+',height='+h+',left='+x+',top='+y);
      }
      if(link){
        link.addEventListener('click', (e)=>{
          try{ e.preventDefault(); }catch(_){ }
          if(!hasClientId){
            alert('Missing CLIENT_ID. Set OAUTH_CLIENT_ID in your .env and restart the server.');
            return;
          }
          openPopupFor(link.getAttribute('href'));
        });
      }
      if(linkRec){
        linkRec.addEventListener('click', (e)=>{
          try{ e.preventDefault(); }catch(_){ }
          if(!hasClientId){
            alert('Missing CLIENT_ID. Set OAUTH_CLIENT_ID in your .env and restart the server.');
            return;
          }
          openPopupFor(linkRec.getAttribute('href'));
        });
      }
    })();
  </script>
</body>
</html>`;
}
