import { layout } from './layout.js';

export function renderHome({ loggedIn=false, username='' } = {}) {
  const body = `
    <div class="hero">
      <h1>All‑in‑one Discord Assistant for Creators</h1>
      <p>Go‑Live alerts, Reaction Roles, Tickets and Music — managed from a clean web dashboard.</p>
      <div class="hero-cta">
        <a class="btn primary" href="/dashboard">Open Dashboard</a>
        <a class="btn-outline" href="/invite">Add to server</a>
      </div>
    </div>

    <div class="section">
      <div class="grid">
        <div class="card"><h3>Go‑Live Alerts</h3><p>Announce Twitch & YouTube streams with branded embeds and a “Watch Now” button.</p></div>
        <div class="card"><h3>Reaction Roles</h3><p>Let members pick roles via modern button menus.</p></div>
        <div class="card"><h3>Tickets</h3><p>Private ticket channels that staff can open/close in one click.</p></div>
        <div class="card"><h3>Music</h3><p>Play YouTube links and searches in your voice channels.</p></div>
      </div>
    </div>

    <div class="section muted">© ${new Date().getFullYear()} The Forge</div>
  `;

  return layout('The Forge — Home', body);
}