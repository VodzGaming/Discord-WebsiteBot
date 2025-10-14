export const modulesList = [
  { key: 'welcome', name: 'Welcome', icon: '👋', category: 'Core', desc: 'Welcome new members with a message or embed.', href: (guildId)=>`/dashboard/guild/${guildId}/welcome` },
  { key: 'welcome_channel', name: 'Welcome Channel', icon: '🪪', category: 'Core', desc: 'Send a card-style welcome image when members join.', href: (guildId)=>`/dashboard/guild/${guildId}/welcome-channel` },
  { key: 'roles', name: 'Reaction Roles', icon: '🎛️', category: 'Engagement', desc: 'Members click buttons to get roles.', href: (guildId)=>`/dashboard/guild/${guildId}/roles` },
  { key: 'live', name: 'Go‑Live Alerts', icon: '🔴', category: 'Notifications', desc: 'Announce Twitch & YouTube streams.', href: (guildId)=>`/dashboard/guild/${guildId}/live` },
  { key: 'tickets', name: 'Tickets', icon: '🎟️', category: 'Support', desc: 'Open/close private support tickets.', href: (guildId)=>`/dashboard/guild/${guildId}/tickets` },
  { key: 'music', name: 'Music', icon: '🎵', category: 'Entertainment', desc: 'Play music in voice channels.', href: (guildId)=>`/dashboard/guild/${guildId}/music` }
];

export function findModule(key){ return modulesList.find(m=>m.key===key); }
