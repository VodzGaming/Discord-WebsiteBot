import express from 'express';
import crypto from 'crypto';
export const webhookRouter = express.Router();

// Capture raw body for Twitch signature verification
webhookRouter.use((req, _res, next)=>{
	if(req.headers['twitch-eventsub-message-id']){
		let data = '';
		req.setEncoding('utf8');
		req.on('data', (chunk)=> data += chunk);
		req.on('end', ()=>{ req.rawBody = data; try{ req.body = data ? JSON.parse(data) : {}; }catch{} next(); });
	} else {
		next();
	}
});

function verifyTwitchSig(req){
	try{
		const secret = process.env.TWITCH_EVENTSUB_SECRET || '';
		if(!secret) return false;
		const msgId = req.headers['twitch-eventsub-message-id'];
		const ts = req.headers['twitch-eventsub-message-timestamp'];
		const sig = String(req.headers['twitch-eventsub-message-signature']||'');
		const hmac = crypto.createHmac('sha256', secret);
		const body = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body||{});
		hmac.update(String(msgId||'')); hmac.update(String(ts||'')); hmac.update(body||'');
		const expected = 'sha256=' + hmac.digest('hex');
		return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
	}catch{ return false; }
}

// Twitch EventSub webhook endpoint
webhookRouter.post('/twitch/eventsub', (req, res) => {
	if(!verifyTwitchSig(req)) return res.status(403).json({ ok:false });
	const type = req.headers['twitch-eventsub-message-type'];
	if(type === 'webhook_callback_verification'){
		return res.status(200).send(String(req.body?.challenge||''));
	}
	// notification
	try{
		const event = req.body?.event || {};
		console.log('[twitch:eventsub]', req.body?.subscription?.type, 'for', event?.broadcaster_user_name || event?.broadcaster_user_id);
	}catch{}
	res.json({ ok: true });
});

// Generic webhook endpoint
webhookRouter.post('/generic-live', (req, res) => {
	try{ console.log('[webhook] generic-live', { ua: req.headers['user-agent'] }); }catch{}
	res.json({ ok:true });
});

let ytTimer = null;
export function startLiveWatchers(){
	if(ytTimer) clearInterval(ytTimer);
	ytTimer = setInterval(()=>{
		try{ console.log('[watchers] YouTube poll tick'); }catch{}
	}, 5*60*1000);
}