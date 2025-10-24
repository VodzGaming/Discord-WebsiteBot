import { layout } from './layout.js';

export const renderLogs = ({ logs=[], page=1, perPage=20, total=0, type=null, guildId=null } = {}) => {
  const esc = s => String(s||'');
  const rows = logs.map(l => `<tr><td style="padding:8px">${new Date(l.created_at).toLocaleString()}</td><td style="padding:8px">${esc(l.user_id)}</td><td style="padding:8px">${esc(l.username)}</td><td style="padding:8px">${esc(l.action)}</td></tr>`).join('\n');
  const types = [ ['dashboard','Dashboard'], ['warnings','Warnings'], ['moderation','Moderation'], ['automod','Automod'], ['commands','Commands'] ];
  const currentType = String(type || 'dashboard');
  const tabs = types.map(t => `<a class="tab ${currentType===t[0]? 'active':''}" href="/logs?type=${encodeURIComponent(t[0])}&page=1&perPage=${perPage}${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}">${t[1]}</a>`).join('');

  const totalPages = Math.max(1, Math.ceil((total||0)/perPage));
  const prevPage = Math.max(1, page-1);
  const nextPage = Math.min(totalPages, page+1);
  const body = `
    <h2 class="h-sub">Logs</h2>
    <div class="card" style="padding:12px 14px;border-radius:14px">
      <div class="tabs" id="logs-tabs" style="display:flex;gap:8px;padding:10px;border-radius:10px;background:rgba(255,255,255,.02);margin-bottom:12px">
        ${tabs}
      </div>
      <div style="overflow:auto">
        <table id="logs-table" style="width:100%;border-collapse:collapse">
          <thead><tr style="text-align:left;background:transparent"><th style="padding:8px">When</th><th style="padding:8px">User ID</th><th style="padding:8px">Username</th><th style="padding:8px">Action</th></tr></thead>
          <tbody>${rows || '<tr><td style="padding:8px" colspan="4">No logs.</td></tr>'}</tbody>
        </table>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
        <div>
          <a class="btn" ${page<=1? 'style="opacity:.5;pointer-events:none"':''} href="/logs?type=${encodeURIComponent(type||'')}&page=${prevPage}&perPage=${perPage}${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}">Previous</a>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          Page <input style="width:40px;text-align:center" value="${page}" /> of ${totalPages}
          <select onchange="location.href='/logs?type=${encodeURIComponent(type||'')}&page=1&perPage='+this.value+'${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}'">
            <option ${perPage==10?'selected':''} value="10">10 rows</option>
            <option ${perPage==20?'selected':''} value="20">20 rows</option>
            <option ${perPage==50?'selected':''} value="50">50 rows</option>
          </select>
        </div>
        <div>
          <a class="btn" ${page>=totalPages? 'style="opacity:.5;pointer-events:none"':''} href="/logs?type=${encodeURIComponent(type||'')}&page=${nextPage}&perPage=${perPage}${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}">Next</a>
        </div>
      </div>
      <div style="margin-top:8px;display:flex;gap:8px">
        <form method="post" action="/logs/backfill"><button class="btn" type="submit">Backfill historical log types</button></form>
        <div style="color:#99a0aa;font-size:13px">Total: ${total} rows</div>
      </div>
    </div>
    <script>
      (function(){
        const perPageSelect = document.querySelector('select');
        const tabs = document.querySelectorAll('#logs-tabs .tab');
        const table = document.getElementById('logs-table');
        const pageInput = document.querySelector('input[type="text"], input[value]');
        function fetchAndRender(qs){
          fetch('/logs?ajax=1&'+qs, { credentials: 'same-origin' }).then(r=>r.json()).then(data=>{
            const rows = (data.logs.map(l => '<tr><td style="padding:8px">' + (new Date(l.created_at).toLocaleString()) + '</td><td style="padding:8px">' + (l.user_id||'') + '</td><td style="padding:8px">' + (l.username||'') + '</td><td style="padding:8px">' + (l.action||'') + '</td></tr>').join('')) || '<tr><td style="padding:8px" colspan="4">No logs.</td></tr>';
            table.querySelector('tbody').innerHTML = rows;
            // update page input and total
            try{ document.querySelector('input').value = data.page; document.querySelector('select').value = data.perPage; }catch(e){}
            // update URL
            history.replaceState({}, '', '/logs?type='+encodeURIComponent(data.type||'')+'&page='+data.page+'&perPage='+data.perPage + (data.guildId?('&guild_id='+encodeURIComponent(data.guildId)) : ''));
          }).catch(()=>{});
        }
        tabs.forEach(t=> t.addEventListener('click', e=>{ e.preventDefault(); const href = t.getAttribute('href'); const qs = href.split('?')[1]; fetchAndRender(qs); }));
        if(perPageSelect) perPageSelect.addEventListener('change', ()=>{ const q = 'type='+encodeURIComponent('${currentType}')+'&page=1&perPage='+perPageSelect.value+'${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}'; fetchAndRender(q); });
        // page input enter -> fetch
        try{ const pg = document.querySelector('input'); pg.addEventListener('change', ()=>{ const q = 'type='+encodeURIComponent('${currentType}')+'&page='+pg.value+'&perPage='+document.querySelector('select').value+'${guildId?`&guild_id=${encodeURIComponent(guildId)}`:''}'; fetchAndRender(q); }); }catch(e){}
      })();
    </script>
  `;
  return layout('Logs', body);
}
