import { layout } from './layout.js';

export function renderHome({ loggedIn=false } = {}) {
  const primaryCta = `<a class="btn" href="/invite">Add To Server</a>`;
  const secondaryCta = loggedIn ? `<a class="btn-outline" href="/dashboard">Open Dashboard</a>` : `<a class="btn-outline" href="/login">Login with Discord</a>`;

  const body = `
    <section class="landing-hero">
      <div class="wrap" style="max-width:1240px">
        <div class="hero-grid">
          <div class="hero-col hero-left">
            <h1 class="display-title">The Discord Bot that<br/>does it all.<br/>Automatically</h1>
            <p class="hero-subtext">A fully customizable Discord bot with a simple, fast web dashboard. Reaction roles, go‑live alerts, tickets, music, and more — streamlined for creators and communities.</p>
            <div class="cta-row">${primaryCta}${secondaryCta}</div>
            <p class="hero-note muted">Built for speed and reliability. No fluff — just the tools you need.</p>
          </div>
          <div class="hero-col hero-right">
            <div class="device">
              <div class="device-screen">
                <div class="device-ui">
                  <div class="ui-top">
                    <div class="ui-card"></div>
                    <div class="ui-card"></div>
                    <div class="ui-card"></div>
                  </div>
                  <div class="ui-grid">
                    <div class="ui-block"></div>
                    <div class="ui-block"></div>
                    <div class="ui-block"></div>
                    <div class="ui-block"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="section features">
          <div class="grid">
            <div class="card"><div class="icon64">📣</div><h3 class="title is-4" style="margin-top:8px">Go‑Live Alerts</h3><p class="muted">Automatic Twitch & YouTube announcements with buttons.</p></div>
            <div class="card"><div class="icon64">🎭</div><h3 class="title is-4" style="margin-top:8px">Reaction Roles</h3><p class="muted">Buttons or dropdowns for quick role assignment.</p></div>
            <div class="card"><div class="icon64">🎶</div><h3 class="title is-4" style="margin-top:8px">Music</h3><p class="muted">Play and queue tracks in your voice channels.</p></div>
            <div class="card"><div class="icon64">🎫</div><h3 class="title is-4" style="margin-top:8px">Tickets</h3><p class="muted">Simple support channels your staff will love.</p></div>
          </div>
        </div>

        <div class="section" style="text-align:center">
          <div class="muted">© ${new Date().getFullYear()} The Forge</div>
        </div>
      </div>
    </section>
  `;

  return layout('The Forge — Home', body, { loggedIn, hideSidebar: true });
}