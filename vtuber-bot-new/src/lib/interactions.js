import { getReactionMenuByMessageId, addWebLog } from './db.js';

export async function handleInteractions(ix){
	try{
		if(!ix || !('isButton' in ix)) return;
		if(ix.isButton()){
			const id = ix.customId || '';
			if(!id.startsWith('rr:')) return;
			const roleId = id.slice(3);
			const guild = ix.guild;
			if(!guild) return ix.reply({ content:'Server not available.', ephemeral:true });
			const role = await guild.roles.fetch(roleId).catch(()=>null);
			if(!role) return ix.reply({ content:'Role not found.', ephemeral:true });
			const member = await guild.members.fetch(ix.user.id).catch(()=>null);
			if(!member) return ix.reply({ content:'Member not found.', ephemeral:true });
			const has = member.roles.cache.has(role.id);
			try{
				if(has){
					await member.roles.remove(role.id);
					await ix.reply({ content:'Removed '+role.name, ephemeral:true });
				} else {
					// Enforce allow_multi if configured on this message
					try{
						const menu = getReactionMenuByMessageId(ix.message?.id);
						if(menu && !menu.allow_multi){
							const others = (menu.roles||[]).map(r=>r.role_id).filter(rid=> rid && rid !== role.id && member.roles.cache.has(rid));
							if(others.length){
								try{ await member.roles.remove(others).catch(()=>{}); }catch(_){ /* ignore */ }
							}
						}
					}catch(_){ /* ignore */ }
					await member.roles.add(role.id);
					await ix.reply({ content:'Assigned '+role.name, ephemeral:true });
				}
			}catch(e){
				try{ await ix.reply({ content:'Failed: '+(e?.message||'Unknown'), ephemeral:true }); }catch(_){ /* ignore */ }
				try{ addWebLog({ guild_id: guild.id, user_id: ix.user?.id, username: ix.user?.username, action: `Reaction Roles button failed for @${role?.name||roleId}: ${e?.message||'Unknown'}`, action_type: 'dashboard' }); }catch(_){ }
			}
		}
	}catch(e){ /* swallow */ }
}