import { layout } from './layout.js';

export function renderModulesPage({ guildId, guild=null, cards=[] }={}){
  const esc = (s='') => String(s).replace(/[&<>"]/g, t=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[t]));
  const modulesHtml = cards.map(c=>{
    const href = c.toggleHref || '';
    const disabled = !href || !/\/dashboard\/guild\//.test(href);
    return `<div class="module-card" data-title="${esc(c.title)}" data-desc="${esc(c.desc)}" data-enabled="${c.enabled ? '1' : '0'}" data-category="${esc(c.category||'')}">
      <div class="m-top">
        <div>
          <div class="m-title">${c.icon?`<span class="m-ico">${esc(c.icon)}</span>`:''}${esc(c.title)}</div>
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
      /* Breadcrumb inherits global .crumbs styles from layout; override to neutral on this overview page */
      .crumbs .crumb{ color:#cdd1db; text-decoration:none }
      .crumbs .crumb:hover{ color:#fff }
      .crumbs .sep{ opacity:.5 }
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
      .switch{ display:inline-block; width:42px; height:24px; background:#2b2f36; border-radius:999px; position:relative }
      .switch input{ display:none }
      .switch .knob{ position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#cbd5e1; transition:all .18s }
      .switch.on{ background:linear-gradient(90deg,#7c3aed,#a855f7) }
      .switch.on .knob{ left:21px; background:white }
      .modules-empty{ display:none; margin-top:8px; color:#98a0ab }
      .chip{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px solid #2b2d31; background:#0f131c; color:#d7d9df; cursor:pointer; font-weight:600; font-size:12px }
      .chip.active{ border-color:#8b5cf6; background: rgba(139,92,246,.12); color:#fff }
      .hl{ background: rgba(139,92,246,.25); color:#fff; border-radius:4px; padding:0 2px }
    </style>

    <div class="topbar">
  <div class="brand"><div class="crumbs" style="display:flex;gap:8px;align-items:center"><span class="crumb">Modules</span></div></div>
      <div style="display:flex;gap:10px;align-items:center">
        <a class="btn" href="/dashboard${guildId?`?guild_id=${guildId}`:''}">Back to Dashboard</a>
      </div>
    </div>

    <div style="margin-top:6px">
      <div style="margin-bottom:8px; position:relative; max-width:680px">
        <input id="modules-search" placeholder="Search modules" style="width:100%;padding:.6rem 2.2rem .6rem .6rem;border-radius:6px;border:1px solid #232733;background:#0b0f14;color:#e5e7eb"/>
        <button id="modules-clear" title="Clear" aria-label="Clear search" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:#1a1f2b; color:#cbd0d9; border:1px solid #2b2d31; border-radius:6px; padding:2px 6px; cursor:pointer; display:none">×</button>
      </div>
      <div class="modules-filter-chips" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; align-items:center">
        <button class="chip" data-state="all">All</button>
        <button class="chip" data-state="enabled">Enabled</button>
        <button class="chip" data-state="disabled">Disabled</button>
        <button class="chip" id="modules-filter-toggle" title="Show categories">Filter</button>
        <button class="chip" id="modules-reset" title="Reset filters">Reset</button>
      </div>
      <div class="modules-grid">
        ${modulesHtml}
      </div>
      <div class="modules-empty">No matching modules</div>
    </div>
    <script>
      // Toggle behavior
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
              if(disabled || !href){ alert('Select a server first to enable modules.'); return; }
              const next = !input.checked;
              input.checked = next; sw.classList.toggle('on', next);
              try{
                const resp = await fetch(href, { method: 'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: 'enabled=' + encodeURIComponent(next ? '1' : '0') });
                if(!resp.ok) throw new Error('HTTP '+resp.status);
              }catch(err){ input.checked = !next; sw.classList.toggle('on', input.checked); alert('Failed to save. Please try again.'); }
            });
          });
        }catch(e){ console.error(e); }
      })();
      // Search + filter with persistence
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
          // build category chips dynamically
          const catWrap = (function(){ const d=document.createElement('div'); d.className='modules-cat-chips'; d.style.display='none'; d.style.gap='8px'; d.style.flexWrap='wrap'; d.style.margin='8px 0 0'; return d; })();
          const catTitle = (function(){ const s=document.createElement('div'); s.textContent='Categories'; s.style.margin='8px 0 4px'; s.style.color='#98a0ab'; s.style.fontSize='12px'; s.style.display='none'; return s; })();
          const chipsHost = document.querySelector('.modules-filter-chips');
          if(chipsHost && chipsHost.parentElement){ chipsHost.parentElement.insertBefore(catTitle, chipsHost.nextSibling); chipsHost.parentElement.insertBefore(catWrap, catTitle.nextSibling); }
          const cards = Array.from(grid.querySelectorAll('.module-card'));
          const norm = (s)=> (s||'').toString().toLowerCase();
          const escapeRegex = (s)=> s.replace(/([.*+?^$(){}|[\]\\])/g, '\\$1');
          const escapeHtml = (s)=> s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;');
          let currentState = 'all';
          let currentCategory = 'all';
          // Remember original text for highlight toggle
          cards.forEach(card=>{
            const tEl = card.querySelector('.m-title');
            const dEl = card.querySelector('.m-desc');
            if(tEl && !card.dataset.otitle){ card.dataset.otitle = tEl.textContent || ''; }
            if(dEl && !card.dataset.odesc){ card.dataset.odesc = dEl.textContent || ''; }
          });
          const setChipActive = ()=>{ chips.forEach(c=> c.classList.toggle('active', c.getAttribute('data-state')===currentState)); };
          // collect categories and counts
          const catCounts = new Map();
          const catSet = new Set();
          cards.forEach(c=>{ const cat=(c.getAttribute('data-category')||'').trim(); if(cat){ catSet.add(cat); catCounts.set(cat, (catCounts.get(cat)||0)+1); } });
          const cats = ['all', ...Array.from(catSet).sort((a,b)=> a.localeCompare(b))];
          const totalCount = cards.length;
          const catChips = [];
          if(catWrap){
            cats.forEach(cat=>{
              const btn = document.createElement('button');
              btn.className = 'chip';
              btn.setAttribute('data-cat', cat);
              const count = cat==='all' ? totalCount : (catCounts.get(cat)||0);
              btn.textContent = (cat==='all' ? 'All Categories' : cat) + ' (' + count + ')';
              catWrap.appendChild(btn);
              catChips.push(btn);
            });
          }
          // Toggle show/hide by Filter button
          const filterBtn = document.getElementById('modules-filter-toggle');
          function setCatsVisible(v){ const disp = v? 'flex':'none'; if(catWrap) catWrap.style.display = disp; if(catTitle) catTitle.style.display = v? 'block':'none'; if(filterBtn) filterBtn.classList.toggle('active', !!v); ls.set('ui.modules.filterOpen', v ? '1':'0'); }
          if(filterBtn){ filterBtn.addEventListener('click', ()=> setCatsVisible(!(catWrap && catWrap.style.display !== 'none'))); }
          const setCatActive = ()=>{ catChips.forEach(c=> c.classList.toggle('active', (c.getAttribute('data-cat')||'')===currentCategory)); };
          const resetBtn = document.getElementById('modules-reset');
          if(resetBtn){ resetBtn.addEventListener('click', ()=> resetAllFilters()); }
          const updateURL = (q, state, cat)=>{ try{ const url = new URL(window.location.href); if(q){ url.searchParams.set('q', q); } else { url.searchParams.delete('q'); } if(state && state!=='all'){ url.searchParams.set('state', state); } else { url.searchParams.delete('state'); } if(cat && cat!=='all'){ url.searchParams.set('cat', cat); } else { url.searchParams.delete('cat'); } window.history.replaceState({}, '', url.toString()); }catch(e){} };
          const apply = ()=>{
            const q = norm(input.value);
            clearBtn.style.display = q ? '' : 'none';
            const terms = q.split(/\s+/).filter(Boolean);
            let shown = 0;
            const rx = terms.length ? new RegExp('(' + terms.map(t=>escapeRegex(escapeHtml(t))).join('|') + ')', 'gi') : null;
            // Fast path: show all when state=all, category=all, and no search terms
            const currentCatNormFast = (currentCategory||'all').toString().trim().toLowerCase();
            const currentStateNormFast = (currentState||'all').toString().trim().toLowerCase();
            if(currentStateNormFast === 'all' && currentCatNormFast === 'all' && terms.length === 0){
              cards.forEach(card=>{ card.style.display=''; const tEl = card.querySelector('.m-title'); const dEl = card.querySelector('.m-desc'); if(tEl && typeof card.dataset.otitle !== 'undefined') tEl.innerHTML = escapeHtml(card.dataset.otitle); if(dEl && typeof card.dataset.odesc !== 'undefined') dEl.innerHTML = escapeHtml(card.dataset.odesc); });
              shown = cards.length;
              if(empty){ empty.style.display = shown === 0 ? '' : 'none'; }
              updateURL(q, currentState, currentCategory);
              ls.set('ui.modules.state', currentState);
              ls.set('ui.modules.cat', currentCategory);
              return;
            }
            cards.forEach(card=>{
              const tEl = card.querySelector('.m-title');
              const dEl = card.querySelector('.m-desc');
              const enabled = card.getAttribute('data-enabled') === '1';
              const cat = (card.getAttribute('data-category')||'').toString().trim().toLowerCase();
              if(tEl && typeof card.dataset.otitle !== 'undefined') tEl.innerHTML = escapeHtml(card.dataset.otitle);
              if(dEl && typeof card.dataset.odesc !== 'undefined') dEl.innerHTML = escapeHtml(card.dataset.odesc);
              const stateOk = currentState==='all' || (currentState==='enabled' && enabled) || (currentState==='disabled' && !enabled);
              const currentCatNorm = (currentCategory||'all').toString().trim().toLowerCase();
              const catOk = currentCatNorm==='all' || (cat === currentCatNorm);
              const hay = norm((card.dataset.otitle||'') + ' ' + (card.dataset.odesc||'') + ' ' + (card.getAttribute('data-category')||''));
              const textOk = terms.length===0 || terms.every(t=> hay.includes(t));
              const match = stateOk && catOk && textOk;
              card.style.display = match ? '' : 'none';
              if(match){ shown++; if(rx){ if(tEl){ tEl.innerHTML = (tEl.innerHTML||'').replace(rx, '<span class="hl">$1</span>'); } if(dEl){ dEl.innerHTML = (dEl.innerHTML||'').replace(rx, '<span class="hl">$1</span>'); } } }
            });
            if(empty){ empty.style.display = shown === 0 ? '' : 'none'; }
            updateURL(q, currentState, currentCategory);
            ls.set('ui.modules.state', currentState);
            ls.set('ui.modules.cat', currentCategory);
          };
          // Explicit full reset helper
          const resetAllFilters = ()=>{
            currentState = 'all';
            currentCategory = 'all';
            setChipActive();
            setCatActive();
            input.value = '';
            // show all and clear any highlights
            cards.forEach(card=>{ card.style.display=''; const tEl = card.querySelector('.m-title'); const dEl = card.querySelector('.m-desc'); if(tEl && typeof card.dataset.otitle !== 'undefined') tEl.innerHTML = escapeHtml(card.dataset.otitle); if(dEl && typeof card.dataset.odesc !== 'undefined') dEl.innerHTML = escapeHtml(card.dataset.odesc); });
            if(empty){ empty.style.display = cards.length === 0 ? '' : 'none'; }
            updateURL('', 'all', 'all');
            try{ localStorage.setItem('ui.modules.state','all'); localStorage.setItem('ui.modules.cat','all'); }catch(e){}
            // collapse categories panel on full reset
            try{ setCatsVisible(false); localStorage.setItem('ui.modules.filterOpen','0'); }catch(e){}
            apply();
          };
          // Debounce typing
          let timer = null;
          input.addEventListener('input', ()=>{ clearTimeout(timer); timer = setTimeout(apply, 140); });
          if(clearBtn){ clearBtn.addEventListener('click', ()=>{ input.value=''; input.focus(); apply(); }); }
          chips.forEach(ch=>{ ch.addEventListener('click', ()=>{
            const next = ch.getAttribute('data-state') || 'all';
            if(next === 'all'){
              resetAllFilters();
              return;
            }
            currentState = next;
            setChipActive();
            apply();
          }); });
          catChips.forEach(ch=>{ ch.addEventListener('click', ()=>{ currentCategory = ch.getAttribute('data-cat') || 'all'; if((currentCategory||'').toLowerCase()==='all'){ ls.set('ui.modules.cat','all'); input.value=''; } setCatActive(); apply(); }); });
          // Restore from URL or localStorage
          try{ const params = new URLSearchParams(window.location.search); const q0 = params.get('q') || ''; let s0 = (params.get('state') || ''); let c0 = (params.get('cat') || ''); if(!s0) s0 = ls.get('ui.modules.state','all'); if(!c0) c0 = ls.get('ui.modules.cat','all'); if(q0){ input.value = q0; } if(['all','enabled','disabled'].includes((s0||'').toLowerCase())) currentState = (s0||'all').toLowerCase(); if(cats.includes(c0)) currentCategory = c0; setChipActive(); setCatActive(); const openPref = ls.get('ui.modules.filterOpen','0')==='1'; if(currentCategory !== 'all' || openPref) setCatsVisible(true); }catch(e){}
          apply();
        }catch(e){ console.error(e); }
      })();
    </script>
  `;

  return layout('Modules', body, { guildId });
}
