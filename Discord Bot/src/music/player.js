// Minimal music player for Discord using @discordjs/voice + play-dl
// Contract:
// - musicInit(): initialize maps/cleanup loop
// - musicJoinAndPlay({ guild, channelId, url }): ensure connection, enqueue, and start if idle
// - musicSkip(guildId): skip current track; returns boolean for whether something was skipped
// - musicQueue(guildId): returns an array of queued items [{ title, url }]

import {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	NoSubscriberBehavior,
	VoiceConnectionStatus,
	entersState
} from '@discordjs/voice';
import * as playdl from 'play-dl';

// Per‑guild state
const players = new Map(); // guildId -> AudioPlayer
const connections = new Map(); // guildId -> VoiceConnection
const queues = new Map(); // guildId -> [{ title, url }]
const currents = new Map(); // guildId -> { title, url }

function getQueue(guildId){
	if(!queues.has(guildId)) queues.set(guildId, []);
	return queues.get(guildId);
}

function getOrCreatePlayer(guildId){
	if(players.has(guildId)) return players.get(guildId);
	const p = createAudioPlayer({ behavior: NoSubscriberBehavior.Play });
	// When a track finishes, advance the queue
	p.on(AudioPlayerStatus.Idle, () => {
		try{ playNext(guildId); }catch{}
	});
	p.on('error', err => {
		// Log and try to continue to next
		try{ console.warn('[music] player error', guildId, err?.message || err); }catch{}
		try{ playNext(guildId); }catch{}
	});
	players.set(guildId, p);
	return p;
}

function ensureConnection(guild, channelId){
	const guildId = guild.id;
	const existing = connections.get(guildId);
	if(existing){
		try{ if(existing.joinConfig.channelId === channelId) return existing; }catch{}
		try{ existing.destroy(); }catch{}
		connections.delete(guildId);
	}
	const conn = joinVoiceChannel({
		channelId,
		guildId,
		adapterCreator: guild.voiceAdapterCreator
	});
	connections.set(guildId, conn);
	return conn;
}

async function createResourceFromUrl(url){
	// Use play-dl to create a stream/resource
	const stream = await playdl.stream(url, { discordPlayerCompatibility: true });
	return createAudioResource(stream.stream, { inputType: stream.type });
}

async function infoFromUrl(url){
	try{
		const info = await playdl.video_info(url).catch(()=>null);
		const title = info?.video_details?.title || url;
		return { title };
	}catch{
		return { title: url };
	}
}

async function playNext(guildId){
	const q = getQueue(guildId);
	const next = q.shift();
	if(!next){
		currents.delete(guildId);
		// If queue empty, let player go idle; connection can be cleaned up by GC interval
		return false;
	}
	currents.set(guildId, next);
	const player = getOrCreatePlayer(guildId);
	const res = await createResourceFromUrl(next.url);
	player.play(res);
	return true;
}

export function musicQueue(guildId){
	const cur = currents.get(guildId);
	const list = getQueue(guildId).slice();
	return cur ? [cur, ...list] : list;
}

export function musicSkip(guildId){
	const player = players.get(guildId);
	if(!player) return false;
	try{ player.stop(); return true; }catch{ return false; }
}

export async function musicJoinAndPlay({ guild, channelId, url }){
	if(!guild || !channelId || !url) throw new Error('guild, channelId, and url are required');
	const guildId = guild.id;
	const conn = ensureConnection(guild, channelId);
	const player = getOrCreatePlayer(guildId);
	// Bind connection to player
	try{ conn.subscribe(player); }catch{}
	// Wait until we are ready to send audio, but don't hang forever
	try{ await entersState(conn, VoiceConnectionStatus.Ready, 10_000); }catch{}

	// Enqueue the track
	const meta = await infoFromUrl(url);
	const q = getQueue(guildId);
	const isPlaying = player.state?.status === AudioPlayerStatus.Playing;
	const item = { title: meta.title, url };
	if(isPlaying || currents.has(guildId)){
		q.push(item);
		return { queued: true, title: item.title };
	} else {
		// Start immediately
		q.unshift(item); // place at front so playNext picks it
		await playNext(guildId);
		return { playing: true, title: item.title };
	}
}

export function musicInit(){
	// Periodic cleanup for dead voice connections
	setInterval(()=>{
		for(const [gid, conn] of connections){
			try{
				if(!conn || conn.state.status === VoiceConnectionStatus.Destroyed){
					connections.delete(gid);
					continue;
				}
				// If idle for a while and no queue/current, destroy
				const hasQueue = (queues.get(gid)||[]).length > 0 || currents.has(gid);
				if(!hasQueue && conn.state.status !== VoiceConnectionStatus.Ready){
					try{ conn.destroy(); }catch{}
					connections.delete(gid);
				}
			}catch{}
		}
	}, 60_000);
}
