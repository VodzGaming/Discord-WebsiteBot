import { layout } from './layout.js';

export function renderCommands(){
  const body = `
    <div class="h-sub">Commands</div>
    <div class="section">
      <div class="card">
        <div style="margin-bottom:12px">This page will list all available bot commands and allow customizing permissions, aliases, and behavior per-server.</div>
        <div style="color:#98a0ab">Placeholder content — you can implement the commands UI here later.</div>
      </div>
    </div>
  `;
  return layout('Commands', body);
}
