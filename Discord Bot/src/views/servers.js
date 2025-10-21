import { layout } from './layout.js';

export function renderServers({ user, manageable }){
  const esc = (s='') => String(s).replace(/[&<>\"]/g, t=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[t]));
  const items = manageable.map(g => {
    const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=160` : '';
    const letter = esc(g.name).slice(0,1).toUpperCase();
    return `
      <div class="server-card">
        <div class="sc-left">
          <div class="sc-avatar">${icon ? `<img src="${icon}" alt=""/>` : `<span>${letter}</span>`}</div>
        </div>
        <div class="sc-body">
          <div class="sc-title">${esc(g.name)}</div>
          <div class="sc-sub">Owner/Manager</div>
        </div>
        <div class="sc-actions">
          <a class="btn primary" href="/dashboard/guild/${g.id}/listing">Go</a>
          <a class="btn outline" href="/invite?guild_id=${g.id}">Setup</a>
        </div>
      </div>
    `;
  }).join('');

  const body = `
    <style>
      .servers-wrap{ display:flex; gap:28px; align-items:flex-start }
      .servers-list{ width:360px }
      .server-card{ display:flex; gap:12px; align-items:center; background:rgba(18,21,29,.6); border:1px solid rgba(255,255,255,.03); padding:12px; border-radius:12px; margin-bottom:14px }
      .sc-avatar{ width:64px; height:64px; border-radius:10px; overflow:hidden; background:#15171b; display:flex; align-items:center; justify-content:center; color:#bfc6cf; font-weight:700 }
      .sc-avatar img{ width:100%; height:100%; object-fit:cover }
      .sc-title{ font-weight:700 }
      .sc-sub{ color:#98a0ab; font-size:13px }
      .sc-actions{ margin-left:auto; display:flex; gap:8px }
      .btn.primary{ background: linear-gradient(90deg,#7c3aed,#a855f7); color:white; padding:.45rem .8rem; border-radius:10px; text-decoration:none }
      .btn.outline{ background:transparent; border:1px solid rgba(255,255,255,.06); padding:.45rem .8rem; border-radius:10px; color:#d7d9df; text-decoration:none }
      @media(max-width:900px){ .servers-wrap{ flex-direction:column } .servers-list{ width:100% } }
    </style>

    <div class="section">
      <div class="h-sub">Select a server</div>
      <div class="servers-wrap">
        <div style="flex:1">
          <!-- left column can hold info or a preview in future -->
          <div style="min-height:240px"></div>
        </div>
        <div class="servers-list">
          ${items || '<i>No manageable servers found.</i>'}
        </div>
      </div>
    </div>
  `;
  return layout('Select a server', body);
}
