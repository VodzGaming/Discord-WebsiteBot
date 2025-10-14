import { layout } from './layout.js';

export function ManageGuild({ guild, textChannels, roleList, tracked, guildId, esc }){
  const trackedList = tracked.length
    ? tracked.map(r => `
        <li style="margin:6px 0">
          <b>${r.platform}</b> ${esc(r.display_name || r.channel_id)}
          → ${r.announce_channel_id
              ? '#'+(textChannels.find(c=>c.id===r.announce_channel_id)?.name || r.announce_channel_id)
              : '(default)'}
          <form style="display:inline" method="post" action="/dashboard/untrack">
            <input type="hidden" name="id" value="${r.id}"/>
            <input type="hidden" name="guild_id" value="${guildId}"/>
            <button class="btn-outline" style="padding:4px 8px;margin-left:6px">Remove</button>
          </form>
        </li>
      `).join('')
    : '<i class="muted">None</i>';

  return layout(`Manage ${esc(guild.name)}`, `
    <h1 style="margin-bottom:4px">${esc(guild.name)}</h1>
    <div class="muted" style="margin-bottom:12px">ID: ${guild.id}</div>

    <div class="tabs">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="live">Live Alerts</button>
      <button class="tab" data-tab="tickets">Tickets</button>
      <button class="tab" data-tab="roles">Reaction Roles</button>
    </div>

    <!-- Overview -->
    <section id="tab-overview">
      <div class="grid">
        <div class="card">
          <div class="icon64">📡</div>
          <div>
            <b>Currently tracked creators</b>
            <ul style="margin:10px 0 0; padding-left:18px">${trackedList}</ul>
          </div>
        </div>
        <div class="card">
          <div class="icon64">⚙️</div>
          <div>
            <b>Quick Tips</b>
            <div class="muted">Use tabs to configure each feature. Changes apply immediately.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Live Alerts -->
    <section id="tab-live" class="hide">
      <div class="card">
        <h3 style="margin-top:0">Add / Update a creator</h3>
        <form method="post" action="/dashboard/guild/${guildId}/live">
          <div class="row">
            <div>
              <label>Platform</label>
              <select name="platform">
                <option value="twitch">Twitch</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            <div>
              <label>Display Name (optional)</label>
              <input type="text" name="display_name"/>
            </div>
          </div>

          <label>Channel (Twitch username or YouTube channel URL/ID/handle)</label>
          <input type="text" name="channel_id" required/>

          <div class="row">
            <div>
              <label>Announce Channel</label>
              <select name="announce_channel_id">
                <option value="">(use default)</option>
                ${textChannels.map(c=>`<option value="${c.id}">#${esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:flex;align-items:center;gap:8px;margin-top:28px">
                <input type="checkbox" name="mention_everyone" value="true"/> Mention @everyone
              </label>
            </div>
          </div>

          <div style="margin-top:12px">
            <button class="btn">Save</button>
          </div>
        </form>
      </div>

      <div class="card" style="margin-top:12px">
        <b>Tracked in this server</b>
        <ul style="margin:10px 0 0; padding-left:18px">${trackedList}</ul>
      </div>
    </section>

    <!-- Tickets -->
    <section id="tab-tickets" class="hide">
      <div class="card">
        <h3 style="margin-top:0">Post a Ticket Panel</h3>
        <form method="post" action="/dashboard/guild/${guildId}/ticket/panel">
          <label>Channel</label>
          <select name="channel_id">
            ${textChannels.map(c=>`<option value="${c.id}">#${esc(c.name)}</option>`).join('')}
          </select>
          <div style="margin-top:12px"><button class="btn">Post Panel</button></div>
        </form>
      </div>
    </section>

    <!-- Roles -->
    <section id="tab-roles" class="hide">
      <div class="card">
        <h3 style="margin-top:0">Create Reaction Role Menu</h3>
        <form method="post" action="/dashboard/guild/${guildId}/roles/menu">
          <div class="row">
            <div>
              <label>Channel</label>
              <select name="channel_id">
                ${textChannels.map(c=>`<option value="${c.id}">#${esc(c.name)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label>Title</label>
              <input type="text" name="title" placeholder="Choose your roles" required/>
            </div>
          </div>

          <div class="card" style="margin:12px 0">
            <b>Pick up to five roles</b>
            <div style="max-height:240px; overflow:auto; margin-top:8px">
              ${roleList.map(r=>`
                <label style="display:block; margin:6px 0">
                  <input type="checkbox" name="role_ids" value="${r.id}"/> ${esc(r.name)}
                </label>
              `).join('')}
            </div>
          </div>

          <div><button class="btn">Create Menu</button></div>
        </form>
      </div>
    </section>

    <script>
      // Simple tab switcher
      document.querySelectorAll('.tab').forEach(t=>{
        t.addEventListener('click', ()=>{
          document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
          t.classList.add('active');
          const id = t.dataset.tab;
          ['overview','live','tickets','roles'].forEach(name=>{
            const el = document.getElementById('tab-'+name);
            if (!el) return;
            el.classList.toggle('hide', name !== id);
          });
        });
      });
    </script>
  `);
}
