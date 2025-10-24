import { layout } from './layout.js';

export default function renderRolesMenusPage({ guild, guildId, textChannels, menus }) {
  const channelOptions = textChannels.map(c => `<option value="${c.id}">#${c.name}</option>`).join('');
  const rows = menus.map(m => {
    const status = m.exists === true ? 'Exists' : (m.exists === false ? 'Deleted/Missing' : 'Unknown');
    const channelName = textChannels.find(c => c.id === m.channel_id)?.name || '#deleted-channel';
    const rolesList = (m.roles || []).map(r => `${r.emoji || '❔'} <@&${r.roleId}>`).join(', ');
    const messageLink = m.channel_id && m.message_id ? `https://discord.com/channels/${guildId}/${m.channel_id}/${m.message_id}` : '';
    return `
      <tr data-id="${m.id}" data-channel="${m.channel_id||''}" data-status="${m.exists===true?'exists':(m.exists===false?'missing':'unknown')}" data-search="${String(rolesList||'').replace(/"/g,'&quot;')}">
        <td><input type="checkbox" class="rowcheck" value="${m.id}" /></td>
        <td>${m.id}</td>
        <td>${m.type || 'reactions'}</td>
        <td>${channelName}</td>
        <td>${m.message_id ? `<a href="${messageLink}" target="_blank">${m.message_id}</a>` : '-'}</td>
        <td>${rolesList || '-'}</td>
        <td>${status}</td>
        <td>
          <button data-action="sync" data-id="${m.id}">Sync</button>
          <form method="POST" action="/dashboard/guild/${guildId}/roles/menu/${m.id}/delete" onsubmit="return confirm('Delete this menu?');" style="display:inline-block;">
            <button type="submit">Delete</button>
          </form>
          <a href="/dashboard/guild/${guildId}/roles/menu/${m.id}/delete" style="margin-left:6px;">Link delete</a>
        </td>
      </tr>`;
  }).join('\n');
  return `
  <html>
    <head>
      <title>Reaction Menus - ${guild?.name || guildId}</title>
      <style>
        body{font-family: system-ui, sans-serif; padding:20px;}
        table{width:100%; border-collapse: collapse;}
        th, td{border:1px solid #ddd; padding:8px;}
        th{background:#f5f5f5; text-align:left;}
        .toolbar{display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap;}
        .toast{position:fixed; right:16px; bottom:16px; background:#222; color:#fff; padding:10px 14px; border-radius:6px; opacity:0; transform:translateY(10px); transition: all .2s ease;}
        .toast.show{opacity:1; transform:translateY(0);}
        .filters{display:flex; gap:8px; align-items:center;}
      </style>
    </head>
    <body>
      <h2>Reaction Role Menus</h2>
      <div class="toolbar">
        <form method="POST" action="/dashboard/guild/${guildId}/roles/menus/prune_missing" onsubmit="return confirm('Prune menus whose messages are missing?');">
          <button type="submit">Prune missing messages</button>
        </form>
        <a href="/dashboard/guild/${guildId}/roles">← Back to Roles Builder</a>
        <form id="bulkDeleteForm" method="POST" action="/dashboard/guild/${guildId}/roles/menus/bulk_delete" style="margin-left:auto;display:flex;gap:8px;align-items:center;">
          <button type="button" id="selectAll">Select all</button>
          <button type="button" id="clearAll">Clear</button>
          <input type="hidden" name="ids" id="bulkIds" />
          <button type="submit" onclick="return collectAndConfirm();">Bulk delete</button>
        </form>
      </div>
      <div class="filters">
        <label>Channel: <select id="fChannel"><option value="">All</option>${channelOptions}</select></label>
        <label>Status: <select id="fStatus"><option value="">All</option><option value="exists">Exists</option><option value="missing">Missing</option><option value="unknown">Unknown</option></select></label>
        <label>Search: <input id="fSearch" type="text" placeholder="role, emoji, id..." /></label>
      </div>
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" id="mastercheck" /></th>
            <th>ID</th>
            <th>Type</th>
            <th>Channel</th>
            <th>Message</th>
            <th>Roles</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="rows">
          ${rows || '<tr><td colspan="8" style="text-align:center;color:#666;">No menus yet.</td></tr>'}
        </tbody>
      </table>
      <div class="toast" id="toast"></div>
      <script>
        function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 2500); }
        function collectAndConfirm(){
          const ids=[...document.querySelectorAll('.rowcheck:checked')].map(i=>i.value);
          if(!ids.length){ toast('No menus selected.'); return false; }
          if(!confirm('Bulk delete '+ids.length+' menus?')) return false;
          document.getElementById('bulkIds').value = ids.join(',');
          return true;
        }
        document.getElementById('selectAll').addEventListener('click',()=>{
          document.querySelectorAll('.rowcheck').forEach(c=> c.checked=true);
        });
        document.getElementById('clearAll').addEventListener('click',()=>{
          document.querySelectorAll('.rowcheck').forEach(c=> c.checked=false);
        });
        document.getElementById('mastercheck').addEventListener('change',(e)=>{
          const on=e.target.checked; document.querySelectorAll('.rowcheck').forEach(c=> c.checked=on);
        });
        // Filters
        function applyFilters(){
          const ch = document.getElementById('fChannel').value;
          const st = document.getElementById('fStatus').value;
          const q = document.getElementById('fSearch').value.toLowerCase();
          document.querySelectorAll('#rows tr').forEach(tr=>{
            const okCh = !ch || tr.dataset.channel===ch;
            const okSt = !st || tr.dataset.status===st;
            const okQ = !q || (tr.dataset.search||'').toLowerCase().includes(q) || tr.innerText.toLowerCase().includes(q);
            tr.style.display = (okCh && okSt && okQ) ? '' : 'none';
          });
        }
        ['fChannel','fStatus','fSearch'].forEach(id=>{
          document.getElementById(id).addEventListener('input', applyFilters);
          document.getElementById(id).addEventListener('change', applyFilters);
        });
        // Sync button: AJAX
        document.querySelectorAll('button[data-action="sync"]').forEach(btn=>{
          btn.addEventListener('click', async ()=>{
            const id = btn.dataset.id;
            btn.disabled = true; btn.textContent = 'Syncing...';
            try{
              const r = await fetch('/dashboard/guild/${guildId}/roles/menu/' + id + '/sync', { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
              const j = await r.json().catch(()=>null);
              if (r.ok) toast('Synced ' + (j?.added ?? 0) + ' reactions'); else toast('Sync failed: ' + (j?.error || r.statusText));
            }catch(e){ toast('Sync failed'); }
            btn.disabled = false; btn.textContent = 'Sync';
          });
        });
      </script>
    </body>
  </html>`;
}
