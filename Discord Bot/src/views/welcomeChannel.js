import { layout } from './layout.js';

export function renderWelcomeChannel({ guild, guildId, textChannels, settings, saved=false }){
  const esc = (s='') => String(s).replace(/[&<>"]/g, t=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[t]));
  const title = guild ? esc(guild.name) : `Guild ${guildId}`;
  const channelOptions = textChannels.map(c => `<option value="${c.id}" ${String(settings.channel_id || '')===String(c.id)?'selected':''}>#${esc(c.name)}</option>`).join('');
  const cfg = (()=>{ try{ return settings.custom_image_json ? JSON.parse(settings.custom_image_json) : {}; }catch(e){ return {}; } })();

  const body = `
  <style>
    .w-grid{ display:grid; grid-template-columns: minmax(0,1fr) 420px; column-gap:16px; row-gap:16px; max-width: 1280px }
    @media (max-width: 1100px){ .w-grid{ grid-template-columns: 1fr } }
    .card{ width:100%; padding:20px 22px; border-radius:8px; background:#181a20; border:1px solid rgba(255,255,255,.06) }
    .label{ color:#c9cdd4; font-size:12px; display:inline-block; margin-bottom:6px }
    select, input[type=text]{ background:#0f1216; color:#e5e7eb; border:1px solid #262b35; border-radius:8px; padding:10px 12px; outline:none; width:100% }
    .switch{ display:inline-block; width:42px; height:24px; background:#2b2f36; border-radius:999px; position:relative }
    .switch input{ display:none }
    .switch .knob{ position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#cbd5e1; transition:all .18s }
    .switch.on{ background:linear-gradient(90deg,#7c3aed,#a855f7) }
    .switch.on .knob{ left:21px; background:white }
    .subtle{ color:#9aa3ae; font-size:11px; letter-spacing:.08em; text-transform:uppercase }
    .theme-grid{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px }
    .theme-tile{ position:relative; border-radius:10px; overflow:hidden; border:1px solid #202530; cursor:pointer; background:#0b1118 }
    .theme-tile img{ display:block; width:100%; height:88px; object-fit:cover }
    .theme-ov{ position:absolute; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:8px; background:linear-gradient(180deg,rgba(0,0,0,0) 30%, rgba(0,0,0,.55)); color:#e5e7eb; font-size:12px; opacity:0; transition:opacity .18s }
    .theme-actions{ position:absolute; top:8px; right:8px; display:flex; gap:6px; opacity:0; transition:opacity .18s }
    .theme-actions .btn-ico{ border:none; background:rgba(17,24,39,.75); color:#e5e7eb; padding:6px 8px; border-radius:8px; font-size:12px }
    .theme-tile:hover .theme-ov, .theme-tile:hover .theme-actions{ opacity:1 }
    .theme-tile.is-selected{ outline:2px solid #8b5cf6; box-shadow:0 0 0 2px rgba(139,92,246,.25) inset }
  </style>
  <div class="topbar">
    <div class="brand"><div class="crumbs" style="display:flex;gap:8px;align-items:center"><a class="crumb" href="/modules?guild_id=${guildId}">Modules</a><span class="sep">/</span><span>Welcome Channel</span></div></div>
    <div style="display:flex;gap:16px;align-items:center">
      <button class="btn" type="button" id="header-publish">Publish</button>
      <a class="btn" href="/dashboard?guild_id=${guildId}">Back</a>
    </div>
  </div>
  <div class="w-grid">
    <div class="modules">
      <form id="wc-form" method="post" action="/dashboard/guild/${guildId}/welcome-channel">
        <div class="card">
          <label class="label">Welcome Message Channel</label>
          <select name="channel_id">
            <option value="">(Select a channel)</option>
            ${channelOptions}
          </select>
          <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
            <span class="muted" style="font-size:13px">Send a welcome card when a user joins the server</span>
            <label class="switch ${settings.enabled? 'on':''}"><input id="wc-enabled" type="checkbox" name="enabled" ${settings.enabled?'checked':''}/><span class="knob"></span></label>
          </div>
        </div>
        <div class="card" style="margin-top:12px">
          <div class="subtle">Customize your welcome card</div>
          <div style="margin-top:10px">
            <label class="label">Background</label>
            <input id="ban-bg-url" type="text" placeholder="https://..." value="${esc(cfg.backgroundUrl||'')}" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
            <div>
              <label class="label">Title</label>
              <input id="ban-title" type="text" placeholder="{username} just joined the server" value="${esc(cfg.title||'')}" />
            </div>
            <div>
              <label class="label">Subtitle</label>
              <input id="ban-sub" type="text" placeholder="Member # {server.member_count}" value="${esc(cfg.subtitle||'')}" />
            </div>
          </div>
          <div style="margin-top:12px">
            <label class="label">Preview</label>
            <canvas id="ban-canvas" width="960" height="360" style="width:100%;max-width:100%;background:#0b1118;border:1px solid #10151c;border-radius:8px"></canvas>
          </div>
          <div style="margin-top:8px">
            <div class="subtle" style="margin-bottom:6px">Choose a theme</div>
            <div class="theme-grid" id="theme-grid"></div>
          </div>
          <input type="hidden" name="custom_image_json" id="banner-json-hidden" value="${esc(settings.custom_image_json||'')}" />
          <input type="hidden" name="custom_image_data" id="banner-data-hidden" value="" />
        </div>
      </form>
    </div>
    <div>
      <div class="card">
        <div class="previewTitle">Preview</div>
        <div class="previewDesc">This shows the card that will be sent.</div>
        <div style="margin-top:10px"><canvas id="ban-canvas-rt" width="960" height="360" style="width:100%;max-width:100%;background:#0b1118;border:1px dashed #263042;border-radius:8px"></canvas></div>
      </div>
    </div>
  </div>
  <script>
    (function(){
      const form = document.getElementById('wc-form');
      const btn = document.getElementById('header-publish');
      const enabled = document.getElementById('wc-enabled');
      const bg = document.getElementById('ban-bg-url');
      const ttl = document.getElementById('ban-title');
      const sub = document.getElementById('ban-sub');
      const c = document.getElementById('ban-canvas');
      const crt = document.getElementById('ban-canvas-rt');
      const hiddenCfg = document.getElementById('banner-json-hidden');
      const hiddenData = document.getElementById('banner-data-hidden');
      const grid = document.getElementById('theme-grid');
      const themes = [
        { id:'t1', url:'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop' },
        { id:'t2', url:'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop' },
        { id:'t3', url:'https://images.unsplash.com/photo-1503264116251-35a269479413?q=80&w=1200&auto=format&fit=crop' },
        { id:'t4', url:'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1200&auto=format&fit=crop' }
      ];
      function draw(ctx, cfg){
        const W=ctx.canvas.width, H=ctx.canvas.height;
        ctx.fillStyle='#0b1118'; ctx.fillRect(0,0,W,H);
        if(cfg.backgroundUrl){ const img=new Image(); img.crossOrigin='anonymous'; img.onload=()=>{ ctx.drawImage(img,0,0,W,H); doText(); save(); }; img.onerror=()=>{ doText(); save(); }; img.src=cfg.backgroundUrl; } else { doText(); save(); }
        function doText(){
          ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(0,0,W,H);
          ctx.textAlign='center';
          ctx.font='bold 56px Inter, Arial'; ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=8; ctx.shadowOffsetY=2; ctx.fillText(cfg.title||'Welcome to {server}', W/2, H/2-12);
          ctx.font='500 28px Inter, Arial'; ctx.fillStyle='#e5e7eb'; ctx.shadowBlur=6; ctx.shadowOffsetY=1; ctx.fillText(cfg.subtitle||'Member # {server.member_count}', W/2, H/2+32); ctx.shadowBlur=0; ctx.shadowOffsetY=0;
        }
        function save(){ try{ hiddenData.value = c.toDataURL('image/png'); if(crt){ const ctx2=crt.getContext('2d'); ctx2.clearRect(0,0,crt.width,crt.height); ctx2.drawImage(c,0,0); } }catch(e){} }
      }
      function cfg(){ return { backgroundUrl:(bg?.value||'').trim(), title:(ttl?.value||'').trim(), subtitle:(sub?.value||'').trim() }; }
      function sync(){ const j=JSON.stringify(cfg()); if(hiddenCfg) hiddenCfg.value=j; const ctx=c.getContext('2d'); draw(ctx, cfg()); }
      [bg, ttl, sub].forEach(el=>{ if(el) el.addEventListener('input', sync); });
      // themes
      if(grid){
        const cur=(bg?.value||'').trim();
        grid.innerHTML='';
        for(const t of themes){ const tile=document.createElement('div'); tile.className='theme-tile'+(cur===t.url?' is-selected':''); const i=document.createElement('img'); i.src=t.url; const ov=document.createElement('div'); ov.className='theme-ov'; ov.textContent='Recommended size ~960x360'; const act=document.createElement('div'); act.className='theme-actions'; const use=document.createElement('button'); use.type='button'; use.className='btn-ico'; use.textContent='Use'; use.addEventListener('click',()=>{ if(bg){ bg.value=t.url; sync(); } }); act.appendChild(use); tile.appendChild(i); tile.appendChild(ov); tile.appendChild(act); grid.appendChild(tile); }
      }
      sync();
      if(btn && form){ btn.addEventListener('click', ()=>{ try{ if(enabled){ const en = form.querySelector('input[name="enabled"]') || enabled; } }catch(e){}; if(typeof form.requestSubmit==='function') form.requestSubmit(); else form.submit(); }); }
      if(form){ form.addEventListener('submit', ()=>{ try{ const en = form.querySelector('input[name="enabled"]'); if(en) en.value = enabled && enabled.checked ? 'on':'off'; }catch(e){}; sync(); }); }
      try{ const was=${saved?'true':'false'}; if(was){ const t=document.createElement('div'); t.textContent='Saved'; t.style.position='fixed'; t.style.right='18px'; t.style.top='18px'; t.style.background='linear-gradient(90deg,#7c3aed,#2563eb)'; t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='8px'; t.style.boxShadow='0 6px 18px rgba(0,0,0,.4)'; t.style.zIndex=9999; document.body.appendChild(t); setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity=0; setTimeout(()=>t.remove(),300); }, 1800); } }catch(e){}
    })();
  </script>`;

  return layout(title + ' — Welcome Channel', body, { guildId });
}
