import { layout } from './layout.js';

export function renderDashboard({ guild, cards=[], recentLogs=[], botSettings=null, textChannels=[], botNickname='', managerRoleIds=[], botRoles=[], botTopPosition=0 } = {}){
  const esc = (s='') => String(s).replace(/[&<>"]/g, t=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[t]));
  const icon = guild && guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=160` : '';
  const title = guild ? esc(guild.name) : 'Dashboard';

  const relTime = (ms)=>{
    const now = Date.now();
    const d = Math.max(0, now - (Number(ms)||0));
    const s = Math.floor(d/1000);
    if(s < 5) return 'just now';
    if(s < 60) return s + 's ago';
    const m = Math.floor(s/60);
    if(m < 60) return m + 'm ago';
    const h = Math.floor(m/60);
    if(h < 24) return h + 'h ago';
    const dd = Math.floor(h/24);
    return dd + 'd ago';
  };

  // Absolute date formatter for Recent Activity (Dyno-like)
  const absDate = (ms) => {
    const dt = new Date(Number(ms)||0);
    try{
      return dt.toLocaleString(undefined, { weekday:'short', month:'short', day:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true });
    }catch(e){
      return dt.toISOString();
    }
  };

  const logsHtml = (recentLogs && recentLogs.length)
    ? [`<div class="recent-head"><div>Date</div><div>User</div><div>Action</div></div>`]
        .concat(recentLogs.map(l=>{
          const when = absDate(l.created_at);
          const who = esc(l.username || '—');
          const initial = (who.trim()[0]||'?').toUpperCase();
          const avatar = l.avatarUrl ? `<img class="rec-avatar-img" src="${esc(l.avatarUrl)}" alt=""/>` : '';
          const avatarNode = avatar || `<div class="rec-avatar">${initial}</div>`;
          const friendlyAction = (a='')=>{
            const s = String(a||'');
            let m;
            m = s.match(/^Saved welcome settings \(enabled=([^,]+),\s*channel=([^\)]+)\)/i);
            if(m){ const en=m[1]; const ch=m[2]; return (ch && ch!=='none') ? `Changed welcome.channel setting: ${ch}` : `Changed welcome.enabled setting: ${en==='1'?'true':en}`; }
            m = s.match(/^Saved Welcome Channel \(enabled=([^,]+),\s*channel=([^\)]+)\)/i);
            if(m){ const en=m[1]; const ch=m[2]; return (ch && ch!=='none') ? `Changed welcome_channel.channel setting: ${ch}` : `Changed welcome_channel.enabled setting: ${en==='1'?'true':en}`; }
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
          const what = esc(friendlyAction(l.action || '—'));
          const actionInner = l.href ? `<a href="${esc(l.href)}" class="rec-action">${what}</a>` : what;
          return `<div class="recent-row">
            <div class="muted">${when}</div>
            <div><div class="rec-user">${avatarNode}<div class="rec-name">@${who}</div></div></div>
            <div>${actionInner}</div>
          </div>`;
        }))
        .join('')
    : `<div class="recent-row"><div class="muted">No recent activity yet</div></div>`;

  const modulesHtml = cards.map(c=>{
    const href = c.toggleHref || '';
    const disabled = !href || !/\/dashboard\/guild\//.test(href);
  return `<div class="module-card" data-title="${esc(c.title)}" data-desc="${esc(c.desc)}" data-enabled="${c.enabled ? '1' : '0'}" data-category="${esc(c.category||'')}">
      <div class="m-top">
        <div>
          <div class="m-title">${c.icon?`<span class=\"m-ico\">${esc(c.icon)}</span>`:''}${esc(c.title)}</div>
          <div class="m-desc">${esc(c.desc)}</div>
        </div>
        <div style="margin-left:auto">
          <label class="switch ${c.enabled? 'on':''}" ${disabled? 'title="Select a server first"':''}>
            <input type="checkbox" data-toggle-href="${esc(href)}" ${c.enabled? 'checked':''} ${disabled? 'disabled':''} ${disabled? 'data-disabled="1"':''} />
            <span class="knob"></span>
          </label>
        </div>
      </div>
  <div class="m-actions"><span class="m-badge ${c.enabled?'on':''}">${c.enabled?'Enabled':'Disabled'}</span><span class="sep-dot" aria-hidden="true">•</span><span class="m-cat">${esc(c.category||'')}</span> <a class="btn-outline" style="margin-left:auto" href="${c.settingsHref}">Settings</a></div>
    </div>`;
  }).join('');

  const body = `
    <style>
  .dash-grid{ display:grid; grid-template-columns: 1fr; gap:18px }
  .top-stack{ display:block; margin-bottom:12px }
  .top-stack .panel{ margin-bottom:12px; min-height:120px }
  .panel.server-info{ padding:24px; box-sizing:inherit; color:#fff }
  /* Make panels opaque to avoid body gradient bleed-through */
  .panel{ background:#12171d; border-radius:10px; padding:16px; border:1px solid rgba(255,255,255,.03) }
    /* Bot Settings layout */
  .panel.bot-settings{ padding:28px; min-height:420px; width:auto; max-width:100%; margin-bottom:12px; box-sizing:border-box; overflow:visible }
  .bot-settings-grid{ display:grid; grid-template-columns:1fr 340px; gap:12px; margin-top:12px }
  .bot-settings-grid .left-col{ grid-column:1; grid-row:1 }
  .bot-settings-grid .right-col{ grid-column:2; grid-row:1 }
  @media(max-width:980px){ .bot-settings-grid{ grid-template-columns:1fr } .bot-settings-grid .right-col{ grid-column:1; grid-row:auto } }
  .panel.bot-settings .form-row{ margin-bottom:18px }
  .panel.bot-settings label{ display:block; font-weight:600; color:#c9cbd1; margin-bottom:10px }
  .panel.bot-settings input, .panel.bot-settings select, .panel.bot-settings textarea{ padding:1rem 1.1rem; border-radius:10px; font-size:14px }
  /* Subpanels on right side for tidy spacing */
  .subpanel{ border:1px solid rgba(255,255,255,.06); background:#0f131c; border-radius:10px; padding:12px; }
  .subpanel + .subpanel{ margin-top:12px }
  .subpanel .sub-title{ font-weight:800; color:#cdd1db; margin:0 0 8px }
  /* Role assign list styles */
  .role-list{ display:flex; flex-direction:column; gap:6px; max-height:260px; overflow:auto; padding:6px; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:#0b0f14 }
  .role-item{ display:flex; align-items:center; gap:8px; padding:10px 12px; background:#0f131c; color:#e5e7eb; border:1px solid #232733; border-radius:8px; cursor:pointer; text-align:left }
  .role-item:hover{ filter:brightness(1.08) }
  .role-item[disabled]{ opacity:.55; cursor:not-allowed }
  /* Disabled button clarity */
  .btn:disabled, .btn-outline:disabled{ opacity:.5; filter:none; cursor:not-allowed }
  .recent-list{ border-top:1px solid rgba(255,255,255,.03); margin-top:12px }
  .recent-head{ display:grid; grid-template-columns: 220px 220px 1fr; column-gap:12px; padding:8px 0; color:#98a0ab; font-size:12px; border-bottom:1px solid rgba(255,255,255,.02) }
  .recent-row{ display:grid; grid-template-columns: 220px 220px 1fr; column-gap:12px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,.02); align-items:center }
  .tag{ display:inline-block; font-size:11px; padding:1px 6px; border-radius:999px; border:1px solid #2b2d31; background:#0f131c; color:#cbd2e1; vertical-align:middle }
  .rec-user{ display:flex; align-items:center; gap:8px }
  .rec-avatar, .rec-avatar-img{ width:22px; height:22px; border-radius:999px; background:#121622; border:1px solid #1f2430; display:inline-flex; align-items:center; justify-content:center; font-weight:700; color:#cbd2e1; font-size:12px; object-fit:cover }
  .rec-name{ color:#e5e7eb; font-weight:600 }
  .rec-action{ color:#e5e7eb; text-decoration:none }
  .rec-action:hover{ text-decoration:underline }
      .switch{ display:inline-block; width:42px; height:24px; background:#2b2f36; border-radius:999px; position:relative }
      .switch input{ display:none }
      .switch .knob{ position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#cbd5e1; transition:all .18s }
      .switch.on{ background:linear-gradient(90deg,#7c3aed,#a855f7) }
      .switch.on .knob{ left:21px; background:white }
  /* Modules grid/card styles (match Modules page) */
  .modules-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:14px }
  .module-card{ border-radius:8px; padding:12px; background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.02)); border:1px solid rgba(255,255,255,0.03) }
  .m-title{ font-weight:700; display:flex; align-items:center; gap:8px }
  .m-ico{ display:inline-flex; width:22px; height:22px; align-items:center; justify-content:center; border-radius:6px; background:#121622; border:1px solid #1f2430 }
  .m-desc{ color:#98a0ab; font-size:13px; margin-top:6px }
  .m-top{ display:flex; gap:12px; align-items:center }
  .m-actions{ display:flex; gap:8px; align-items:center; margin-top:10px }
  .m-actions .sep-dot{ color:#3b4353; margin:0 6px }
  .m-badge{ font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid #283041; background:#0e1320; color:#cbd2e1 }
  .m-badge.on{ background:#132117; border-color:#1f3d27; color:#b6f3c2 }
  .m-cat{ font-size:11px; color:#98a0ab }
  /* Align badge/category spacing in module cards */
  .m-actions{ display:flex; gap:8px; align-items:center; margin-top:10px }
  .m-actions .sep-dot{ color:#3b4353; margin:0 6px }
  @media(max-width:1100px){ .dash-grid{ grid-template-columns: 1fr } .top-stack .panel{ margin-bottom:10px } }
  @media(max-width:760px){ .dash-grid{ grid-template-columns: 1fr } }
  .settings-content .server-info{ display:flex; gap:18px; flex-wrap:wrap }
  .settings-content .server-info li{ color:#d1d5db; font-weight:600 }
  .actions-list a{ text-decoration:none; padding:8px 10px; border-radius:8px }
  .actions-list a:hover{ filter:brightness(1.06) }
  /* Chips and highlight */
  .chip{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid #2b2d31; background:#0f131c; color:#d7d9df; cursor:pointer; font-weight:600; font-size:12px }
  .chip.active{ border-color:#8b5cf6; background: rgba(139,92,246,.12); color:#fff }
  .hl{ background: rgba(139,92,246,.25); color:#fff; border-radius:4px; padding:0 2px }
  /* (Removed) compact actions panel styles */
    </style>

    <div class="page-header">
      <div class="preview-avatar">${icon?`<img src="${icon}" alt=""/>`:`<span style="color:#9aa1ac;font-weight:700">${title.slice(0,1)}</span>`}</div>
      <div>
        <div class="header-title">${title}</div>
        <div class="muted">Server settings & modules</div>
      </div>
      <div class="header-cta"><a class="btn" href="/servers">Manage Servers</a></div>
    </div>

    <div class="top-stack">
  <div class="panel server-info" data-server-id="${guild?.id||''}">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="server-avatar">${title.slice(0,1)}</div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:12px">
              <div class="server-title">SERVER INFO</div>
              <div class="server-subtitle">Members, channels, roles and basic info</div>
            </div>
          </div>
        </div>

        <div class="server-stats">
          <div class="server-stats-row">
            <div class="settings-content">
              <h3 class="title is-5" style="margin:0 0 8px;color:#cdd1db">Server Info</h3>
              <ul class="server-info">
                <li>Members: <span>${guild?.memberCount ?? 8}</span></li>
                <li>Categories: <span>${guild?.channels?.cache?.filter?.(c=>c && (c.type===4 || c.type==='GUILD_CATEGORY'))?.size ?? 6}</span></li>
                <li>Text Channels: <span>${guild?.channels?.cache?.filter?.(c=>c && (c.type===0 || c.type==='GUILD_TEXT'))?.size ?? 37}</span></li>
                <li>Voice Channels: <span>${guild?.channels?.cache?.filter?.(c=>c && (c.type===2 || c.type==='GUILD_VOICE'))?.size ?? 4}</span></li>
                <li>Roles: <span>${guild?.roles?.cache?.size ?? 21}</span></li>
              </ul>

              <ul class="server-info">
                <li><a href="#" class="btn-outline copy-server-id" style="color:#ef476f;border-color:transparent"><span class="icon is-link">📋</span>Copy Server ID</a></li>
                <li><a href="#" class="btn-outline need-help" style="color:#ef476f;border-color:transparent"><span class="icon is-link">❓</span>Need Help?</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

  <div class="panel bot-settings">
        <strong>Bot Settings</strong>
        <form id="bot-settings-form" action="${guild?`/dashboard/guild/${guild.id}/bot/settings`:''}" method="post" style="display:block">
        <div class="bot-settings-grid">
          <div class="left-col">
            <div class="form-row"><label>Command Prefix</label><input name="prefix" value="${esc(botSettings?.prefix || '?')}" maxlength="5"/></div>
            <div class="form-row"><label>Updates Channel <span class="muted">ⓘ</span></label>
              <select name="updates_channel_id">
                <option value="">Select...</option>
                ${Array.isArray(textChannels) ? textChannels.map(c=>`<option value="${esc(c.id)}" ${botSettings?.updates_channel_id===c.id?'selected':''}>#${esc(c.name)}</option>`).join('') : ''}
              </select>
            </div>
            <div class="form-row" style="display:flex;gap:8px;align-items:center">
              <div style="flex:1">
                <label>Timezone</label>
                <select name="timezone" id="tz-select">
                  <option value="">Auto (browser)</option>
                </select>
              </div>
              <div><button class="btn detect" type="button" id="tz-detect">Detect</button></div>
            </div>
            <div class="form-row" style="display:flex;gap:8px;align-items:center"><button class="btn save" type="submit">Save</button>${guild?`<button class=\"btn-outline\" type=\"button\" id=\"send-test\">Send Test Update</button>`:''}<span id="updates-help" class="muted"></span></div>

            <!-- Moved under Timezone: Manager Roles -->
            <div id="manager-roles-form" data-action="${guild?`/dashboard/guild/${guild.id}/bot/manager-roles`:''}" class="subpanel">
              <div class="sub-title">Manager Roles (Owner/Administrator Only)</div>
              <div class="form-row" style="margin-bottom:6px"><div class="muted">Roles allowed to manage bot settings.</div></div>
              <div class="form-row" style="margin-bottom:6px">
                <div class="muted">Bot has:</div>
                <div id="bot-roles-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
                  ${(Array.isArray(botRoles)?botRoles:[]).map(r=>`<span class=\"tag\" data-role-id=\"${esc(r.id)}\">@${esc(r.name)}</span>`).join('') || '<span class="muted">(no roles)</span>'}
                </div>
                  <div style="margin-top:10px">
                    <label for="bot-assign-select">Give the bot a role</label>
                    <select id="bot-assign-select" style="width:100%">
                      <option value="">Select role…</option>
                      ${guild ? Array.from(guild.roles?.cache?.values()||[])
                        .filter(r=>!r.managed && r.id !== guild.id)
                        .sort((a,b)=> a.position-b.position)
                        .map(r=>{
                          const above = (botTopPosition && r.position >= botTopPosition) ? true : false;
                          const already = Array.isArray(botRoles) && botRoles.some(br=> br.id===r.id);
                          const disabled = above || already;
                          const note = above? ' (above bot)' : (already? ' (already has)' : '');
                          return `<option value="${esc(r.id)}" ${disabled?'disabled':''}>@${esc(r.name)}${esc(note)}</option>`;
                        }).join('') : ''}
                    </select>
                    <div id="bot-assign-status" class="muted" aria-live="polite" style="margin-top:6px;min-height:18px"></div>
                  </div>
              </div>
              
            
            </div>

            <!-- Moved under Timezone: Announcement -->
            <div class="subpanel">
              <div class="sub-title">Announcement</div>
              <div class="form-row" style="margin-bottom:10px"><textarea id="ann-content" placeholder="Write your update..." style="min-height:100px"></textarea></div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:0">
                <label class="checkbox" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ann-everyone"/> <span>Mention @everyone</span></label>
                <select id="ann-role" style="max-width:260px"><option value="">Mention role...</option>${guild?Array.from(guild.roles?.cache?.values()||[]).filter(r=>!r.managed).map(r=>`<option value=\"${esc(r.id)}\">@${esc(r.name)}</option>`).join(''):''}</select>
              </div>
              <div style="display:flex;gap:8px;margin-top:10px"><button class="btn" type="button" id="ann-send">Send</button><button class="btn-outline" type="button" id="ann-preview">Preview</button></div>
              <div id="ann-preview-box" style="display:none;margin-top:10px;padding:10px;border:1px solid rgba(255,255,255,.06);border-radius:8px;background:#0f131c"></div>
            </div>
          </div>
          <div class="right-col">
            <div class="subpanel">
              <div class="sub-title">Nickname</div>
              <div class="form-row" style="margin:0"><div style="display:flex;gap:8px;align-items:center"><input id="nick-input" value="${esc(botNickname||'')}" placeholder="Forge Hammer"/><button class="btn" type="button" id="nick-save">Update</button></div></div>
            </div>
          </div>
        </div>
        </form>
  </div>

  <div class="panel">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <strong>Recent Activity</strong>
          <a href="/logs?type=dashboard${guild?`&guild_id=${guild.id}`:''}" class="muted" style="text-decoration:none">View all</a>
        </div>
        <div class="recent-list">
          ${logsHtml}
        </div>
      </div>
    </div>

  

    <div class="dash-grid">
      <div>
        <div style="margin-top:6px">
          <strong>Modules</strong>
          <div style="margin-top:12px">
            <div style="margin-bottom:8px; position:relative">
              <input id="modules-search" placeholder="Search" style="width:100%;padding:.6rem 2.2rem .6rem .6rem;border-radius:6px;border:1px solid #232733;background:#0b0f14;color:#e5e7eb"/>
              <button id="modules-clear" title="Clear" aria-label="Clear search" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:#1a1f2b; color:#cbd0d9; border:1px solid #2b2d31; border-radius:6px; padding:2px 6px; cursor:pointer; display:none">×</button>
            </div>
            <div class="modules-filter-chips" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px">
              <button class="chip" data-state="all">All</button>
              <button class="chip" data-state="enabled">Enabled</button>
              <button class="chip" data-state="disabled">Disabled</button>
              <button class="chip" id="modules-filter-toggle" title="Show categories">Filter</button>
              <button class="chip" id="modules-reset" title="Reset filters">Reset</button>
            </div>
            <div class="modules-grid">
              ${modulesHtml}
            </div>
            <div class="modules-empty muted" style="display:none;margin-top:8px">No matching modules</div>
          </div>
        </div>
      </div>
    </div>
    <script>
      // Tiny IANA TZ list (subset) for convenience
      // Full IANA list (condensed common set + browser detect fill-in)
      const TZ_LIST = [
        'UTC','Etc/GMT','Etc/GMT+1','Etc/GMT-1','Europe/London','Europe/Paris','Europe/Berlin','Europe/Madrid','Europe/Rome','Europe/Warsaw','Europe/Moscow','Europe/Istanbul','Africa/Cairo','Africa/Johannesburg',
        'Asia/Jerusalem','Asia/Dubai','Asia/Kolkata','Asia/Kathmandu','Asia/Bangkok','Asia/Singapore','Asia/Hong_Kong','Asia/Tokyo','Asia/Seoul','Australia/Perth','Australia/Adelaide','Australia/Sydney','Pacific/Auckland',
        'America/St_Johns','America/Halifax','America/Toronto','America/Chicago','America/Denver','America/Los_Angeles','America/Anchorage','Pacific/Honolulu','America/Mexico_City','America/Bogota','America/Lima','America/Sao_Paulo'
      ];
      (function(){
        try{
          const tzSel = document.getElementById('tz-select');
          if(tzSel){
            const cur = ${JSON.stringify(null)};
            TZ_LIST.forEach(t=>{ const opt=document.createElement('option'); opt.value=t; opt.textContent=t; tzSel.appendChild(opt); });
            const saved = ${JSON.stringify(''+(undefined))} || ${JSON.stringify('')};
            try{ const s='${(botSettings?.timezone||'').replace(/'/g,"&#39;")}'; if(s){ tzSel.value = s; } }catch(e){}
            if(saved){ tzSel.value = saved; }
          }
          const detectBtn = document.getElementById('tz-detect');
          if(detectBtn && tzSel){ detectBtn.addEventListener('click', ()=>{ try{ const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; if(tz){ tzSel.value = tz; } }catch(e){} }); }
          const form = document.getElementById('bot-settings-form');
          if(form){ form.addEventListener('submit', (e)=>{ /* allow normal POST for now */ }); }
          const testBtn = document.getElementById('send-test');
          const updatesSelect = document.querySelector('select[name="updates_channel_id"]');
          const updatesHelp = document.getElementById('updates-help');
          function refreshUpdatesState(){ const has = !!(updatesSelect && (updatesSelect.value && updatesSelect.value.length>0)); if(testBtn){ testBtn.disabled = !has; } if(updatesHelp){ updatesHelp.textContent = has ? '' : 'Select an Updates Channel to enable sending.'; } }
          refreshUpdatesState(); if(updatesSelect){ updatesSelect.addEventListener('change', refreshUpdatesState); }
          if(testBtn){ testBtn.addEventListener('click', async ()=>{ try{ const resp = await fetch('/dashboard/guild/${guild?guild.id:''}/bot/send-test-update', { method:'POST', headers:{'X-Requested-With':'XMLHttpRequest'} }); if(!resp.ok){ const t=await resp.text(); throw new Error(t||('HTTP '+resp.status)); } alert('Test update sent (check updates channel)'); }catch(e){ alert('Failed to send test update: '+(e?.message||'Unknown')); } }); }
          // Nickname update
          const nickBtn = document.getElementById('nick-save');
          const nickInput = document.getElementById('nick-input');
          if(nickBtn && nickInput){
            nickBtn.addEventListener('click', async ()=>{
              const nickname = (nickInput.value||'').trim();
              const action = '${guild?`/dashboard/guild/${guild.id}/bot/nickname`:''}';
              if(!action) return;
              try{ await fetch(action, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-Requested-With':'XMLHttpRequest' }, body: new URLSearchParams({ nickname }) });
                const t = document.createElement('div'); t.textContent = 'Nickname updated'; t.style.position='fixed'; t.style.right='18px'; t.style.top='18px'; t.style.background='linear-gradient(90deg,#7c3aed,#2563eb)'; t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='8px'; t.style.boxShadow='0 6px 18px rgba(0,0,0,.4)'; t.style.zIndex=9999; document.body.appendChild(t); setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity=0; setTimeout(()=>t.remove(),300); }, 1200);
              }catch(e){ alert('Failed to update nickname'); }
            });
          }
          // Announcement composer
          const annSend = document.getElementById('ann-send');
          const annPrev = document.getElementById('ann-preview');
          const annBox = document.getElementById('ann-preview-box');
          const annContent = document.getElementById('ann-content');
          const annEveryone = document.getElementById('ann-everyone');
          const annRole = document.getElementById('ann-role');
          function buildPreview(){
            const parts=[]; if(annEveryone?.checked) parts.push('@everyone'); const rid=annRole?.value||''; if(rid) parts.push(annRole.options[annRole.selectedIndex]?.text||'@role');
            const header = parts.length? parts.join(' ')+'\n\n':'';
            return (header + (annContent?.value||'')).trim() || '(empty)';
          }
          if(annPrev && annBox){ annPrev.addEventListener('click', ()=>{ annBox.style.display='block'; annBox.textContent = buildPreview(); }); }
          const hasUpdates = ()=>{ const sel=document.querySelector('select[name="updates_channel_id"]'); return !!(sel && sel.value && sel.value.length>0); };
          if(annSend){ annSend.disabled = !hasUpdates(); if(updatesSelect){ updatesSelect.addEventListener('change', ()=>{ annSend.disabled = !hasUpdates(); }); }
            annSend.addEventListener('click', async ()=>{ try{
              annSend.disabled = true; annSend.textContent='Sending...';
              const payload = new URLSearchParams({ content: annContent?.value||'' });
              if(annEveryone?.checked) payload.set('mention_everyone','1');
              const rid = annRole?.value||''; if(rid) payload.set('mention_role_id', rid);
              const resp = await fetch('/dashboard/guild/${guild?guild.id:''}/bot/announce', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest' }, body: payload });
              if(!resp.ok){ const t=await resp.text(); throw new Error(t||('HTTP '+resp.status)); }
              const toast = document.createElement('div'); toast.textContent='Announcement sent'; toast.style.position='fixed'; toast.style.right='18px'; toast.style.top='18px'; toast.style.background='linear-gradient(90deg,#7c3aed,#10b981)'; toast.style.color='white'; toast.style.padding='10px 14px'; toast.style.borderRadius='8px'; toast.style.boxShadow='0 6px 18px rgba(0,0,0,.4)'; toast.style.zIndex=9999; document.body.appendChild(toast); setTimeout(()=>{ toast.style.transition='opacity .3s'; toast.style.opacity=0; setTimeout(()=>toast.remove(),300); }, 1200);
            }catch(e){ alert('Failed to send: '+(e?.message||'Unknown')); } finally { annSend.disabled=false; annSend.textContent='Send'; }
          }); }

          // Dedicated dropdown to assign a role to the bot (like Timezone style)
          (function(){
            try{
              const sel = document.getElementById('bot-assign-select');
              const chipsHost = document.getElementById('bot-roles-chips');
              const statusEl = document.getElementById('bot-assign-status');
              function setStatus(msg, isError=false){ if(!statusEl) return; statusEl.textContent = msg||''; statusEl.style.color = isError ? '#ef476f' : '#98a0ab'; }
              function addChipOnce(roleId, label){
                if(!chipsHost) return;
                var exists = chipsHost.querySelector('[data-role-id="' + roleId + '"]');
                if(exists) return;
                var placeholder = chipsHost.querySelector('.muted');
                if(placeholder) placeholder.remove();
                var span=document.createElement('span');
                span.className='tag';
                span.setAttribute('data-role-id', roleId);
                span.textContent=(label||'').trim();
                chipsHost.appendChild(span);
              }
              if(!sel) return;
              sel.addEventListener('change', async ()=>{
                const id = sel.value || '';
                if(!id) return;
                const opt = sel.options[sel.selectedIndex];
                const label = opt ? opt.textContent : '@role';
                try{
                  const resp = await fetch('/dashboard/guild/${guild?guild.id:''}/bot/self-roles/add', {
                    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'}, body: new URLSearchParams({ role_id: id })
                  });
                  if(!resp.ok){ let msg=''; try{ const j=await resp.json(); msg=j?.error||''; }catch(_){} if(!msg){ try{ msg=await resp.text(); }catch(_){} } throw new Error(msg||('HTTP '+resp.status)); }
                  const toast = document.createElement('div'); toast.textContent='Bot assigned ' + label; toast.style.position='fixed'; toast.style.right='18px'; toast.style.top='18px'; toast.style.background='linear-gradient(90deg,#7c3aed,#10b981)'; toast.style.color='white'; toast.style.padding='10px 14px'; toast.style.borderRadius='8px'; toast.style.boxShadow='0 6px 18px rgba(0,0,0,.4)'; toast.style.zIndex=9999; document.body.appendChild(toast); setTimeout(()=>{ toast.style.transition='opacity .3s'; toast.style.opacity=0; setTimeout(()=>toast.remove(),300); }, 1200);
                  setStatus('Assigned ' + label);
                  addChipOnce(id, label);
                  if(opt){ opt.disabled = true; }
                }catch(err){ setStatus(err?.message||'Failed to assign role', true); }
                sel.value = '';
              });
            }catch(e){ console.error(e); }
          })();

          // (Removed) manager roles multi-select

          // Manager Roles now posts with the main form via native select (no extra JS needed)
        }catch(e){ console.error(e); }
      })();
      (function(){
        try{
          const panel = document.querySelector('.panel.server-info');
          if(!panel) return;
          const guildId = panel.getAttribute('data-server-id') || '';
          const copyBtn = panel.querySelector('.copy-server-id');
          const helpBtn = panel.querySelector('.need-help');
          if(copyBtn){
            copyBtn.addEventListener('click', e=>{
              e.preventDefault();
              if(!guildId) return;
              navigator.clipboard?.writeText(guildId).then(()=>{
                const t = document.createElement('div');
                t.textContent = 'Copied';
                t.style.position='fixed'; t.style.right='20px'; t.style.bottom='20px'; t.style.background='#111'; t.style.color='white'; t.style.padding='8px 12px'; t.style.borderRadius='8px'; t.style.boxShadow='0 8px 30px rgba(0,0,0,.6)';
                document.body.appendChild(t);
                setTimeout(()=>t.remove(),1800);
              }).catch(()=>alert('Copy failed'));
            });
          }
          if(helpBtn){
            helpBtn.addEventListener('click', e=>{
              e.preventDefault();
              // open help in new tab; change this URL to your actual help page
              const helpUrl = '/help';
              window.open(helpUrl, '_blank');
            });
          }
        }catch(e){console.error(e)}
      })();
      // Module toggle handlers
      (function(){
        try{
          const switches = document.querySelectorAll('.modules-grid label.switch');
          switches.forEach(sw=>{
            sw.addEventListener('click', async (e)=>{
              e.preventDefault();
              const input = sw.querySelector('input[type="checkbox"]');
              if(!input) return;
              const disabled = input.getAttribute('data-disabled') === '1' || input.disabled;
              const href = input.getAttribute('data-toggle-href');
              if(disabled || !href){
                alert('Select a server first to enable modules.');
                return;
              }
              const next = !input.checked;
              // optimistic UI
              input.checked = next;
              sw.classList.toggle('on', next);
              try{
                const resp = await fetch(href, {
                  method: 'POST',
                  headers: { 'Content-Type':'application/x-www-form-urlencoded' },
                  body: 'enabled=' + encodeURIComponent(next ? '1' : '0')
                });
                if(!resp.ok){ throw new Error('HTTP ' + resp.status); }
              }catch(err){
                // revert UI
                input.checked = !next;
                sw.classList.toggle('on', input.checked);
                alert('Failed to save. Please try again.');
              }
            });
          });
        }catch(e){ console.error(e); }
      })();
      // Modules search filter with persistence
      (function(){
        try{
          const ls = { get:(k,d=null)=>{ try{ const v = localStorage.getItem(k); return v==null? d : v; }catch(e){ return d; } }, set:(k,v)=>{ try{ localStorage.setItem(k, v); }catch(e){} } };
          const input = document.getElementById('modules-search');
          const clearBtn = document.getElementById('modules-clear');
          const grid = document.querySelector('.modules-grid');
          const empty = document.querySelector('.modules-empty');
          // Only state chips (exclude the Filter button)
          const chips = Array.from(document.querySelectorAll('.modules-filter-chips .chip[data-state]'));
          if(!input || !grid) return;
          const cards = Array.from(grid.querySelectorAll('.module-card'));
          const norm = (s)=> (s||'').toString().toLowerCase();
          const escapeRegex = (s)=> s.replace(/([.*+?^$(){}|[\]\\])/g, '\\$1');
          const escapeHtml = (s)=> s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          let currentState = 'all'; // 'all' | 'enabled' | 'disabled'
          let currentCategory = 'all'; // category id or 'all'

          // Build category chip row dynamically
          const chipsHost = document.querySelector('.modules-filter-chips');
          const catWrap = (function(){ const d=document.createElement('div'); d.className='modules-cat-chips'; d.style.display='none'; d.style.gap='8px'; d.style.flexWrap='wrap'; d.style.margin='8px 0 0'; return d; })();
          const catTitle = (function(){ const s=document.createElement('div'); s.textContent='Categories'; s.style.margin='8px 0 4px'; s.style.color='#98a0ab'; s.style.fontSize='12px'; s.style.display='none'; return s; })();
          const filterBtn = document.getElementById('modules-filter-toggle');
          function setCatsVisible(v){ const disp = v? 'flex':'none'; if(catWrap) catWrap.style.display = disp; if(catTitle) catTitle.style.display = v? 'block':'none'; if(filterBtn) filterBtn.classList.toggle('active', !!v); ls.set('ui.dashboard.filterOpen', v ? '1':'0'); }
          if(filterBtn){ filterBtn.addEventListener('click', ()=> setCatsVisible(!(catWrap && catWrap.style.display !== 'none'))); }
          if(chipsHost && chipsHost.parentElement){ chipsHost.parentElement.insertBefore(catTitle, chipsHost.nextSibling); chipsHost.parentElement.insertBefore(catWrap, catTitle.nextSibling); }
          // Collect categories from cards
          const catCounts = new Map();
          const catSet = new Set();
          cards.forEach(c=>{ const cat=(c.getAttribute('data-category')||'').trim(); if(cat){ catSet.add(cat); catCounts.set(cat, (catCounts.get(cat)||0)+1); } });
          const cats = ['all', ...Array.from(catSet).sort((a,b)=> a.localeCompare(b))];
          const totalCount = cards.length;
          const catChips = [];
          if(catWrap){
            cats.forEach(cat=>{
              const btn = document.createElement('button');
              btn.className='chip';
              btn.setAttribute('data-cat', cat);
              const count = cat==='all' ? totalCount : (catCounts.get(cat)||0);
              btn.textContent = (cat==='all' ? 'All Categories' : cat) + ' (' + count + ')';
              catWrap.appendChild(btn);
              catChips.push(btn);
            });
          }

          // Remember original text for highlight toggle
          cards.forEach(card=>{
            const tEl = card.querySelector('.m-title');
            const dEl = card.querySelector('.m-desc');
            if(tEl && !card.dataset.otitle){ card.dataset.otitle = tEl.textContent || ''; }
            if(dEl && !card.dataset.odesc){ card.dataset.odesc = dEl.textContent || ''; }
          });

          const setChipActive = ()=>{
            chips.forEach(c=> c.classList.toggle('active', c.getAttribute('data-state')===currentState));
          };
          const setCatActive = ()=>{
            catChips.forEach(c=> c.classList.toggle('active', (c.getAttribute('data-cat')||'')===currentCategory));
          };
          const resetBtn = document.getElementById('modules-reset');
          if(resetBtn){ resetBtn.addEventListener('click', ()=> resetAllFilters()); }

          const updateURL = (q, state, cat)=>{
            try{
              const url = new URL(window.location.href);
              if(q){ url.searchParams.set('q', q); } else { url.searchParams.delete('q'); }
              if(state && state!=='all'){ url.searchParams.set('state', state); } else { url.searchParams.delete('state'); }
              if(cat && cat!=='all'){ url.searchParams.set('cat', cat); } else { url.searchParams.delete('cat'); }
              window.history.replaceState({}, '', url.toString());
            }catch(e){}
          };

          const apply = ()=>{
            const q = norm(input.value);
            clearBtn.style.display = q ? '' : 'none';
            const terms = q.split(/\s+/).filter(Boolean);
            let shown = 0;
            // build highlight regex (on escaped html string)
            const rx = terms.length ? new RegExp('(' + terms.map(t=>escapeRegex(escapeHtml(t))).join('|') + ')', 'gi') : null;
            // Fast path: show all when state=all, category=all, and no search terms
            const currentCatNormFast = (currentCategory||'all').toString().trim().toLowerCase();
            const currentStateNormFast = (currentState||'all').toString().trim().toLowerCase();
            if(currentStateNormFast === 'all' && currentCatNormFast === 'all' && terms.length === 0){
              cards.forEach(card=>{ card.style.display=''; const tEl = card.querySelector('.m-title'); const dEl = card.querySelector('.m-desc'); if(tEl && typeof card.dataset.otitle !== 'undefined') tEl.innerHTML = escapeHtml(card.dataset.otitle); if(dEl && typeof card.dataset.odesc !== 'undefined') dEl.innerHTML = escapeHtml(card.dataset.odesc); });
              shown = cards.length;
              if(empty){ empty.style.display = shown === 0 ? '' : 'none'; }
              updateURL(q, currentState, currentCategory);
              ls.set('ui.dashboard.state', currentState);
              ls.set('ui.dashboard.cat', currentCategory);
              return;
            }
            cards.forEach(card=>{
              const tEl = card.querySelector('.m-title');
              const dEl = card.querySelector('.m-desc');
              const enabled = card.getAttribute('data-enabled') === '1';
              const cat = (card.getAttribute('data-category')||'').toString().trim().toLowerCase();
              if(tEl && typeof card.dataset.otitle !== 'undefined') tEl.innerHTML = escapeHtml(card.dataset.otitle);
              if(dEl && typeof card.dataset.odesc !== 'undefined') dEl.innerHTML = escapeHtml(card.dataset.odesc);
              // state filter
              const stateOk = currentState==='all' || (currentState==='enabled' && enabled) || (currentState==='disabled' && !enabled);
              const currentCatNorm = (currentCategory||'all').toString().trim().toLowerCase();
              const catOk = currentCatNorm==='all' || (cat === currentCatNorm);
              // text match (AND all terms)
              const hay = norm((card.dataset.otitle||'') + ' ' + (card.dataset.odesc||'') + ' ' + (card.getAttribute('data-category')||''));
              const textOk = terms.length===0 || terms.every(t=> hay.includes(t));
              const match = stateOk && catOk && textOk;
              card.style.display = match ? '' : 'none';
              if(match){
                shown++;
                if(rx){
                  if(tEl){ tEl.innerHTML = (tEl.innerHTML||'').replace(rx, '<span class="hl">$1</span>'); }
                  if(dEl){ dEl.innerHTML = (dEl.innerHTML||'').replace(rx, '<span class="hl">$1</span>'); }
                }
              }
            });
            if(empty){ empty.style.display = shown === 0 ? '' : 'none'; }
            updateURL(q, currentState, currentCategory);
            ls.set('ui.dashboard.state', currentState);
            ls.set('ui.dashboard.cat', currentCategory);
          };
          // Explicit full reset helper
          const resetAllFilters = ()=>{
            currentState = 'all';
            currentCategory = 'all';
            setChipActive();
            setCatActive();
            input.value = '';
            cards.forEach(card=>{ card.style.display=''; const tEl = card.querySelector('.m-title'); const dEl = card.querySelector('.m-desc'); if(tEl && typeof card.dataset.otitle !== 'undefined') tEl.innerHTML = escapeHtml(card.dataset.otitle); if(dEl && typeof card.dataset.odesc !== 'undefined') dEl.innerHTML = escapeHtml(card.dataset.odesc); });
            if(empty){ empty.style.display = cards.length === 0 ? '' : 'none'; }
            updateURL('', 'all', 'all');
            try{ localStorage.setItem('ui.dashboard.state','all'); localStorage.setItem('ui.dashboard.cat','all'); }catch(e){}
            // collapse categories panel on full reset
            try{ setCatsVisible(false); localStorage.setItem('ui.dashboard.filterOpen','0'); }catch(e){}
            apply();
          };

          // Debounce typing
          let timer = null;
          input.addEventListener('input', ()=>{ clearTimeout(timer); timer = setTimeout(apply, 140); });
          if(clearBtn){ clearBtn.addEventListener('click', ()=>{ input.value=''; input.focus(); apply(); }); }
          // Chips
          chips.forEach(ch=>{
            ch.addEventListener('click', ()=>{
              const next = ch.getAttribute('data-state') || 'all';
              if(next === 'all'){
                resetAllFilters();
                return;
              }
              currentState = next;
              setChipActive();
              apply();
            });
          });
          catChips.forEach(ch=>{ ch.addEventListener('click', ()=>{ currentCategory = ch.getAttribute('data-cat') || 'all'; if((currentCategory||'').toLowerCase()==='all'){ ls.set('ui.dashboard.cat','all'); input.value=''; } setCatActive(); apply(); }); });

          // Restore from URL or localStorage
          try{
            const params = new URLSearchParams(window.location.search);
            const q0 = params.get('q') || '';
            let s0 = (params.get('state') || '');
            let c0 = (params.get('cat') || '');
            if(!s0) s0 = ls.get('ui.dashboard.state','all');
            if(!c0) c0 = ls.get('ui.dashboard.cat','all');
            if(q0){ input.value = q0; }
            if(['all','enabled','disabled'].includes((s0||'').toLowerCase())) currentState = (s0||'all').toLowerCase();
            setChipActive();
            if(cats.includes(c0)) currentCategory = c0;
            setCatActive();
            const openPref = ls.get('ui.dashboard.filterOpen','0')==='1';
            if(currentCategory !== 'all' || openPref) setCatsVisible(true);
          }catch(e){}
          // Initial apply
          apply();
        }catch(e){ console.error(e); }
      })();
    </script>
  `;

  return layout(title + ' — Dashboard', body, { guildId: guild?.id || '', loggedIn: true });
}