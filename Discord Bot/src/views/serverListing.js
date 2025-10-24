import { layout } from './layout.js';

export function renderServerListing({ guild=null, guildId='' } = {}){
  const esc = (s='') => String(s).replace(/[&<>\"]/g, t=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[t]));
  const icon = guild && guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=160` : '';
  const title = guild ? esc(guild.name) : `Guild ${guildId}`;

  const body = `
    <style>
      .two-col{ display:grid; grid-template-columns: 1fr 420px; gap:20px }
      .panel{ background:rgba(18,21,29,.6); border-radius:10px; padding:16px; border:1px solid rgba(255,255,255,.03) }
      .muted{ color:#98a0ab; font-size:13px }
      .form-row{ margin-bottom:12px }
      input,select,textarea{ width:100%; padding:.6rem .75rem; border-radius:8px; border:1px solid #232733; background:#0b0f14; color:#e5e7eb }
      .actions{ display:flex; gap:12px; margin-top:14px }
      .btn.save{ background:#c0265a; color:white; padding:.6rem 1rem; border-radius:8px; text-decoration:none }
      .btn.reset{ background:transparent; border:1px solid rgba(192,38,90,.35); color:#c0265a; padding:.6rem 1rem; border-radius:8px; }
      .preview-avatar{ width:84px; height:84px; border-radius:12px; overflow:hidden; background:#111214; display:grid; place-items:center }
      .preview-avatar img{ width:100%; height:100%; object-fit:cover }
      @media(max-width:900px){ .two-col{ grid-template-columns: 1fr } }
    </style>

    <div class="h-sub">Server Listing Settings</div>
    <div class="two-col">
      <div>
        <div class="panel">
          <strong>About</strong>
          <div class="muted" style="margin-top:8px">This panel controls and customizes whether and how this server is listed on our server list, which can be found <a href="#">here</a></div>
        </div>

        <div class="panel" style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:center"><strong>Listing Details</strong><label style="color:#86efac">Listed <input type="checkbox" style="margin-left:8px" /></label></div>
          <div style="margin-top:12px">
            <div class="form-row"><label class="muted">Description</label><textarea placeholder="A very interesting server">${esc(guild?.description||'')}</textarea></div>
            <div class="form-row"><label class="muted">Invite URL</label><input placeholder="https://discord.gg/..."/></div>
            <div class="form-row"><label class="muted">Default invite channel</label><select><option>Select Channel</option></select></div>
            <div class="form-row"><label class="muted">Main server language</label><select><option>English</option></select></div>
            <div class="form-row"><label class="muted">Categories</label><select><option>Select...</option></select></div>
            <div class="form-row"><label class="muted">Tags</label><input placeholder="Add Tags (press enter to apply)"/></div>
            <div class="form-row"><label class="muted">YouTube URL</label><input/></div>
            <div class="form-row"><label class="muted">Twitter URL</label><input/></div>
            <div class="form-row"><label class="muted">Twitch URL</label><input/></div>
            <div class="form-row"><label class="muted">Reddit URL</label><input/></div>
            <div class="actions"><a class="btn save" href="#">Save</a><a class="btn reset" href="#">Reset form</a></div>
          </div>
        </div>
      </div>

      <div>
        <div class="panel">
          <div style="display:flex;gap:12px;align-items:center">
            <div class="preview-avatar">${icon?`<img src="${icon}" alt=""/>`:`<span style="color:#9aa1ac;font-weight:700">${title.slice(0,1)}</span>`}</div>
            <div>
              <div style="font-weight:700">${title}</div>
              <div class="muted" style="margin-top:6px">members</div>
            </div>
            <div style="margin-left:auto"><a class="btn save" href="#">Join</a></div>
          </div>
          <div style="margin-top:14px;color:#98a0ab">${esc(guild?.description||'A very interesting server')}</div>
        </div>
      </div>
    </div>
  `;
  return layout('Server Listing Settings', body, { guildId, loggedIn: true });
}
