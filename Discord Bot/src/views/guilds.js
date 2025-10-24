import { layout } from './layout.js';

export function GuildList({ user, manageable, esc }){
  const cards = (manageable || [])
    .map(g => {
      const icon = g.icon
        ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`
        : '';
      const letter = esc(g.name).slice(0,1).toUpperCase();
      return `
        <a class="card server-card" href="/dashboard?guild_id=${g.id}">
          ${icon
            ? `<img class="avatar" src="${icon}" alt="">`
            : `<div class="avatar">${letter}</div>`}
          <div>
            <div style="font-weight:700">${esc(g.name)}</div>
            <div class="muted">Manage</div>
          </div>
        </a>
      `;
    }).join('') || '<i class="muted">No manageable servers found. (You need “Manage Server” permission.)</i>';

  return layout('Your Servers', `
    <section>
      <h1>Servers you manage</h1>
      <p class="muted">Choose a server to open its dashboard.</p>
      <div class="grid">${cards}</div>
    </section>
  `, { loggedIn: true });
}
