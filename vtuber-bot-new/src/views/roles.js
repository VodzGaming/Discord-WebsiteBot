import { layout } from './layout.js';

export function renderRolesPage({ guild, textChannels=[], roleList=[], menus=[], emojis=[] } = {}){
  const esc = (s='') => String(s).replace(/[&<>"]/g, t=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[t]));
  const gname = guild ? esc(guild.name) : 'Server';

  const menusHtml = (menus&&menus.length) ? menus.map(m=>{
    const ch = textChannels.find(c=>c.id===m.channel_id);
    const chName = ch ? '#'+ch.name : '#'+(m.channel_id||'unknown');
    return `<div class="menu-row"><div><b>${esc(chName)}</b> · <span class="muted">message ${esc(m.message_id)}</span></div>
      <div class="muted">Roles: ${(m.roles||[]).map(r=> '@'+esc(r.label || (roleList.find(x=>x.id===r.role_id)?.name || r.role_id))).join(', ') || '(none)'} </div></div>`;
  }).join('') : '<div class="muted">No menus created yet.</div>';

  const body = `
    <style>
      .panel{ background:#12171d; border-radius:10px; padding:16px; border:1px solid rgba(255,255,255,.03) }
      .grid{ display:grid; grid-template-columns:1fr; gap:12px }
      .row{ display:flex; gap:12px; flex-wrap:wrap }
      .muted{ color:#9aa3ad }
      .menu-row{ padding:8px 0; border-bottom:1px solid rgba(255,255,255,.06) }
      .menu-row:last-child{ border-bottom:none }
      .settings-grid{ display:grid; grid-template-columns: 320px 1fr; gap:16px }
      @media(max-width:1100px){ .settings-grid{ grid-template-columns:1fr } }
      .sidebar{ background:#0f131c; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:12px }
      .btn-small{ padding:6px 10px; border-radius:8px; background:#1b2130; border:1px solid #2a3142; color:#e5e7eb; cursor:pointer }
      .card{ background:#0f131c; border:1px solid rgba(255,255,255,.06); border-radius:10px; padding:14px }
      .section-title{ font-weight:800; color:#cdd1db; margin:0 0 8px }
      .field{ margin-bottom:12px }
      .field label{ display:block; font-weight:600; color:#c9cbd1; margin-bottom:6px }
      .tabs{ display:flex; gap:6px; margin:10px 0 }
      .tab{ padding:6px 10px; border-radius:999px; border:1px solid #2b2f36; background:#0f131c; color:#d7d9df; cursor:pointer }
      .tab.active{ background:#1d2331; border-color:#49516a }
  .list{ display:flex; flex-direction:column; gap:8px }
      .list .item{ display:flex; gap:8px; align-items:center }
      .item input[type="text"], .item select{ flex:1 }
      .row-split{ display:flex; gap:12px; flex-wrap:wrap }
  /* Local emoji popover */
  .emoji-pop{ position:absolute; z-index:10000; background:#0f131c; border:1px solid #2a3142; border-radius:10px; padding:8px; width:360px; max-height:360px; overflow:auto; box-shadow: 0 8px 30px rgba(0,0,0,.5) }
  .emoji-pop .tabs{ display:flex; gap:6px; margin:0 0 8px }
  .emoji-pop .tabs .tab{ padding:4px 8px; border-radius:999px; border:1px solid #2b2f36; background:#12171d; color:#d7d9df; cursor:pointer }
  .emoji-pop .tabs .tab.active{ background:#1d2331; border-color:#49516a }
  .emoji-grid{ display:grid; grid-template-columns: repeat(9, 1fr); gap:6px }
  .emoji-cell{ display:flex; align-items:center; justify-content:center; height:36px; border-radius:6px; cursor:pointer; border:1px solid transparent }
  .emoji-cell:hover{ background:#1b2130; border-color:#2a3142 }
    </style>
    <div class="settings-grid">
      <div class="sidebar">
        <button class="btn-small" id="new-message">+ New Message</button>
        <div style="margin-top:12px" class="muted">Existing Menus</div>
        <div style="margin-top:6px">${menusHtml}</div>
      </div>
      <div>
        <div class="card">
          <div class="section-title">Message Settings</div>
          <div class="field"><label>Name</label><input id="rr-name" type="text" placeholder="Give it a unique name"/></div>
          <div class="field"><label>Channel</label><select id="rr-channel"><option value="">Select Channel</option>${textChannels.map(c=>`<option value="${esc(c.id)}">#${esc(c.name)}</option>`).join('')}</select></div>
          <div class="row-split">
            <div class="field" style="min-width:180px"><label>Message Type</label><div class="tabs" id="msg-type-tabs"><button class="tab" data-type="plain">Plain</button><button class="tab" data-type="embed">Embed</button><button class="tab" data-type="existing">Existing</button></div></div>
            <div class="field" style="min-width:180px"><label>Selection Type</label><div class="tabs" id="sel-type-tabs"><button class="tab active" data-type="reactions">Reactions</button><button class="tab" data-type="buttons">Buttons</button><button class="tab" data-type="dropdowns">Dropdowns</button></div></div>
          </div>
          <div id="embed-builder" class="field" style="display:none"><label>Embed Title</label><input id="rr-title" type="text" placeholder="Title"/><label style="margin-top:6px">Embed JSON (optional)</label><textarea id="rr-embed" placeholder='{"description":"React to get roles"}' style="min-height:110px"></textarea></div>
        </div>

        <div class="card" style="margin-top:12px">
          <div class="section-title">Reactions and Roles</div>
          <div class="list" id="pairs"></div>
          <button class="btn-small" id="add-pair" style="margin-top:8px">Add reaction</button>
          <div class="muted" id="pairs-tip" style="margin-top:6px">Tip: Add up to 5. Choose an emoji, then pick a role. For custom Discord emoji, paste its <:name:id> or ID into the small box.</div>
        </div>

        <div class="card" style="margin-top:12px">
          <div class="section-title">Options</div>
          <div class="row-split">
            <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="rr-allow-multi"/> Allow picking multiple roles</label>
            <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="rr-reverse-mode"/> Reverse mode (click again removes)</label>
          </div>
          <div class="row-split" style="margin-top:8px">
            <div style="flex:1"><label>Allowed Roles (optional)</label><input id="rr-allowed" placeholder="Comma separated role IDs"/></div>
            <div style="flex:1"><label>Ignored Roles (optional)</label><input id="rr-ignored" placeholder="Comma separated role IDs"/></div>
          </div>
          <div style="margin-top:12px"><button class="btn" id="publish">Publish</button></div>
          <div id="rr-status" class="muted" style="margin-top:6px; min-height:18px"></div>
        </div>
      </div>
    </div>

    <script>
      (function(){
        const esc = (s)=> (s||'').toString();
        const pairsHost = document.getElementById('pairs');
        const MAX_PAIRS = 5;
        let activeEmojiBtn = null;
        // Local dependency-free picker: guild custom emojis + tiny unicode set
        (function(){
          if(typeof window.__openEmojiLocalPicker === 'function') return;
          const guildEmojis = ${JSON.stringify(emojis || [])};
          const unicodeSets = [
            '😀😁😂🤣😃😄😅😆😉😊😋😎😍😘😗😙😚🙂🤗🤩🤔🤨😐😑😶🙄😏😣😥😮🤐😯😪😫',
            '😴😌😛😜🤪😝🤫🤭🤥😒😓😔😕🙃🤑😲☹️🙁😖😞😟😤😢😭😦😧😨😩🤯😬😰😱',
            '😳🤪😵‍💫🤢🤮🤧😇🥳🥵🥶🤓🧐😈👿💀☠️👻👽🤖💩🎃👍👎👌🤌🤝👏🙏'
          ];
          let pop=null;
          function close(){ if(pop){ pop.remove(); pop=null; } document.removeEventListener('mousedown', onDoc); }
          function onDoc(e){ if(pop && !pop.contains(e.target) && !(e.target && e.target.closest && e.target.closest('.emoji-btn'))){ close(); } }
          function renderCustom(grid, onPick){
            grid.innerHTML='';
            if(!guildEmojis.length){ const d=document.createElement('div'); d.className='muted'; d.textContent='No custom emojis in this server.'; d.style.padding='8px'; grid.appendChild(d); return; }
            guildEmojis.slice(0,300).forEach(e=>{
              const cell=document.createElement('div'); cell.className='emoji-cell'; cell.title=e.name;
              const img=document.createElement('img'); img.src=e.url; img.alt=e.name; img.style.maxWidth='28px'; img.style.maxHeight='28px';
              cell.appendChild(img);
              cell.addEventListener('click', ()=>{ try{ onPick && onPick(e.mention); }catch(_){} close(); });
              grid.appendChild(cell);
            });
          }
          function renderUnicode(grid, onPick){
            grid.innerHTML='';
            unicodeSets.forEach(set=>{
              for(const ch of set){ const cell=document.createElement('div'); cell.className='emoji-cell'; cell.textContent=ch; cell.addEventListener('click', ()=>{ try{ onPick && onPick(ch); }catch(_){} close(); }); grid.appendChild(cell); }
            });
          }
          function open(anchorEl, onPick){
            close();
            pop = document.createElement('div'); pop.className='emoji-pop';
            const tabs = document.createElement('div'); tabs.className='tabs';
            const b1 = document.createElement('button'); b1.className='tab active'; b1.textContent='Custom';
            const b2 = document.createElement('button'); b2.className='tab'; b2.textContent='Unicode';
            tabs.appendChild(b1); tabs.appendChild(b2);
            const grid = document.createElement('div'); grid.className='emoji-grid';
            pop.appendChild(tabs); pop.appendChild(grid);
            b1.addEventListener('click', ()=>{ b1.classList.add('active'); b2.classList.remove('active'); renderCustom(grid, onPick); });
            b2.addEventListener('click', ()=>{ b2.classList.add('active'); b1.classList.remove('active'); renderUnicode(grid, onPick); });
            renderCustom(grid, onPick);
            const r = anchorEl.getBoundingClientRect();
            pop.style.top = ((window.scrollY||document.documentElement.scrollTop) + r.bottom + 8) + 'px';
            pop.style.left = ((window.scrollX||document.documentElement.scrollLeft) + r.left) + 'px';
            document.body.appendChild(pop);
            setTimeout(()=> document.addEventListener('mousedown', onDoc), 0);
          }
          window.__openEmojiLocalPicker = open;
        })();

        // Inline Emoji Mart dynamic loader (kept as secondary option)
        (function(){
          if(typeof window.__openEmojiMartPicker === 'function') return;
          let host=null, root=null;
          function ensureHost(){
            if(host) return;
            host = document.createElement('div');
            host.id = 'emoji-mart-host';
            host.style.position = 'absolute';
            host.style.zIndex = '10000';
            host.style.display = 'none';
            document.body.appendChild(host);
          }
          async function openPicker(anchorEl, onPick){
            ensureHost();
            if(!window.__emojiMartLoaded){
              try{
                const [{ default: React }, { createRoot }, { default: data }, mod] = await Promise.all([
                  import('https://esm.sh/react@18.2.0'),
                  import('https://esm.sh/react-dom@18.2.0/client'),
                  import('https://esm.sh/@emoji-mart/data@1'),
                  import('https://esm.sh/@emoji-mart/react@5?deps=react@18.2.0,react-dom@18.2.0')
                ]);
                window.__emojiMart = { React, createRoot, data, Picker: mod.Picker };
                window.__emojiMartLoaded = true;
              }catch(e){
                console.warn('Emoji Mart import failed, falling back to emoji-picker-element', e);
                // Fallback: load emoji-picker-element as a web component via script tag
                if(!window.__emojiElementLoading && !window.__emojiElementReady){
                  window.__emojiElementLoading = new Promise((resolve, reject)=>{
                    try{
                      const s = document.createElement('script');
                      s.type = 'module';
                      s.src = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/dist/index.js';
                      s.onload = ()=>{ window.__emojiElementReady = true; resolve(); };
                      s.onerror = (err)=> reject(err);
                      document.head.appendChild(s);
                    }catch(err){ reject(err); }
                  });
                }
                try{ await window.__emojiElementLoading; }catch(err){
                  console.error('emoji-picker-element failed to load', err);
                  const v = prompt('Type an emoji (unicode):', ''); if(v!=null){ try{ onPick && onPick(v); }catch(_){} }
                  return;
                }
                // Show emoji-picker-element
                const existing = host.querySelector('emoji-picker');
                if(existing) existing.remove();
                const pickerEl = document.createElement('emoji-picker');
                pickerEl.setAttribute('class', 'dark');
                pickerEl.style.maxWidth = '340px';
                pickerEl.style.height = '380px';
                pickerEl.addEventListener('emoji-click', (ev)=>{
                  try{ onPick && onPick(ev.detail?.unicode || ev.detail?.emoji?.unicode || ''); }catch(_){}
                  hide();
                });
                const r = anchorEl.getBoundingClientRect();
                const top = (window.scrollY || document.documentElement.scrollTop) + r.bottom + 6;
                const left = (window.scrollX || document.documentElement.scrollLeft) + r.left;
                host.style.top = top + 'px';
                host.style.left = left + 'px';
                host.style.display = 'block';
                host.innerHTML = '';
                host.appendChild(pickerEl);
                const onDocClick = (ev)=>{ if(!host.contains(ev.target) && ev.target!==anchorEl){ hide(); document.removeEventListener('mousedown', onDocClick); } };
                document.addEventListener('mousedown', onDocClick);
                return;
              }
            }
            const { React, createRoot, data, Picker } = window.__emojiMart;
            if(!root) root = createRoot(host);
            const r = anchorEl.getBoundingClientRect();
            const top = (window.scrollY || document.documentElement.scrollTop) + r.bottom + 6;
            const left = (window.scrollX || document.documentElement.scrollLeft) + r.left;
            host.style.top = top + 'px';
            host.style.left = left + 'px';
            host.style.display = 'block';
            const handleSelect = (emoji)=>{ try{ onPick && onPick(emoji?.native || ''); }catch(_){} hide(); };
            const comp = React.createElement(Picker, { data, onEmojiSelect: handleSelect, theme: 'dark', perLine: 8, previewPosition: 'none', navPosition: 'top' });
            root.render(comp);
            const onDocClick = (ev)=>{ if(!host.contains(ev.target) && ev.target!==anchorEl){ hide(); document.removeEventListener('mousedown', onDocClick); } };
            document.addEventListener('mousedown', onDocClick);
          }
          function hide(){ if(!host) return; host.style.display = 'none'; if(root){ try{ root.render(null); }catch(_){} } }
          window.__openEmojiMartPicker = openPicker;
        })();
        function updateAddBtnState(){
          const addBtn = document.getElementById('add-pair');
          const count = pairsHost.querySelectorAll('.item').length;
          addBtn.disabled = count >= MAX_PAIRS;
          document.getElementById('pairs-tip').textContent = count >= MAX_PAIRS ? 'You reached the limit of 5 pairs.' : 'Tip: Add up to 5. Choose an emoji, then pick a role. For custom Discord emoji, paste its <:name:id> or ID into the small box.';
        }
        function addPairRow(emoji='', roleId=''){
          const d=document.createElement('div'); d.className='item';
          d.innerHTML =
            '<button type="button" class="btn-small emoji-btn" title="Pick emoji">+'+ (emoji? ' '+emoji : '') +'</button>'+
            '<input class="emoji-val" type="hidden" value="'+emoji+'" />'+
            '<input class="emoji-manual" placeholder=":custom: or ID" style="max-width:160px" />'+
            '<select class="role"><option value="">Select role</option>'+(${JSON.stringify(roleList)}).map(r=>'<'+'option value="'+r.id+'"'+(r.id===roleId?' selected':'')+'>@'+r.name+'</option>').join('')+'</select>'+
            '<button type="button" class="btn-small rm" title="Remove">✕</button>';
          // Remove row
          d.querySelector('.rm').addEventListener('click', ()=>{ d.remove(); updateAddBtnState(); });
          // Emoji picker
          const btn = d.querySelector('.emoji-btn');
          const val = d.querySelector('.emoji-val');
          btn.addEventListener('click', (ev)=>{
            activeEmojiBtn = btn;
            if(typeof window.__openEmojiLocalPicker === 'function'){
              window.__openEmojiLocalPicker(btn, (picked)=>{ if(!picked) return; val.value=picked; btn.textContent = '+ ' + picked; });
              return;
            }
            if(typeof window.__openEmojiMartPicker === 'function'){
              window.__openEmojiMartPicker(btn, (picked)=>{ if(!picked) return; val.value=picked; btn.textContent = '+ ' + picked; });
              return;
            }
            const v = prompt('Type an emoji (unicode):', val.value||''); if(v!=null){ val.value=v; btn.textContent = '+ '+v; }
          });
          pairsHost.appendChild(d);
          updateAddBtnState();
        }
        document.getElementById('add-pair').addEventListener('click', ()=> addPairRow());
        addPairRow(); // initial row

        // Tabs
        function setupTabs(id, onChange){
          const wrap=document.getElementById(id); if(!wrap) return { get:()=>null };
          let current=(wrap.querySelector('.tab.active')?.dataset.type)||null;
          wrap.querySelectorAll('.tab').forEach(b=> b.addEventListener('click', ()=>{ wrap.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); current=b.dataset.type; onChange&&onChange(current); }));
          return { get:()=>current };
        }
        const msgTabs = setupTabs('msg-type-tabs', (t)=>{ document.getElementById('embed-builder').style.display = (t==='embed')? 'block':'none'; });
        const selTabs = setupTabs('sel-type-tabs');

        const statusEl = document.getElementById('rr-status');
        function setStatus(msg, bad){ statusEl.textContent = msg||''; statusEl.style.color = bad? '#ef476f':'#98a0ab'; }

        document.getElementById('publish').addEventListener('click', async ()=>{
          try{
            const name = document.getElementById('rr-name').value.trim();
            const channel_id = document.getElementById('rr-channel').value.trim();
            const message_type = msgTabs.get();
            const selection_type = selTabs.get();
            const title = document.getElementById('rr-title').value.trim();
            const embed_json = document.getElementById('rr-embed').value.trim();
            const allow_multi = document.getElementById('rr-allow-multi').checked ? '1':'0';
            const reverse_mode = document.getElementById('rr-reverse-mode').checked ? '1':'0';
            const allowed_roles = document.getElementById('rr-allowed').value.trim();
            const ignored_roles = document.getElementById('rr-ignored').value.trim();
            const pairs = Array.from(document.querySelectorAll('#pairs .item')).map(it=>{
              const val = it.querySelector('.emoji-val').value.trim();
              const manual = it.querySelector('.emoji-manual').value.trim();
              return { emoji: (val || manual), role_id: it.querySelector('.role').value.trim() };
            }).filter(x=>x.role_id);
            if(!channel_id){ setStatus('Pick a channel', true); return; }
            if(!pairs.length){ setStatus('Add at least one reaction/role pair', true); return; }
            const body = new URLSearchParams();
            body.set('channel_id', channel_id);
            body.set('title', title || name || 'Choose your roles');
            pairs.forEach(p=>{ body.append('role_ids', p.role_id); if(p.emoji){ body.set('emoji_'+p.role_id, p.emoji); } });
            // extras
            body.set('name', name); body.set('message_type', message_type); body.set('selection_type', selection_type);
            body.set('embed_json', embed_json); body.set('allow_multi', allow_multi); body.set('reverse_mode', reverse_mode);
            body.set('allowed_roles', allowed_roles); body.set('ignored_roles', ignored_roles);
            const resp = await fetch('/dashboard/guild/${guild?guild.id:''}/roles/menu', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-Requested-With':'XMLHttpRequest' }, body });
            if(!resp.ok){ const t=await resp.text(); throw new Error(t||('HTTP '+resp.status)); }
            setStatus('Published!', false);
          }catch(e){ setStatus(e?.message||'Failed to publish', true); }
        });
      })();
    </script>
    
  `;
  return layout('Reaction Roles — ' + gname, body, { guildId: guild?.id || '' });
}
