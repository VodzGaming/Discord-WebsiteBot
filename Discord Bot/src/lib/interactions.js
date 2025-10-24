import { getReactionMenuByMessageId, addWebLog, isModuleEnabled } from './db.js';

export async function handleInteractions(ix){
	try{
		if(!ix) return;
		if('isButton' in ix && ix.isButton()){
			const id = ix.customId || '';
			if(!id.startsWith('rr:')) return;
			const roleId = id.slice(3);
			const guild = ix.guild;
			if(!guild) return ix.reply({ content:'Server not available.', ephemeral:true });
			if(!isModuleEnabled(guild.id, 'roles')) return ix.reply({ content:'Reaction Roles module is disabled in this server.', ephemeral:true });
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
		// Dropdown (StringSelectMenu): customId 'rrs'
		else if('isStringSelectMenu' in ix && ix.isStringSelectMenu && ix.isStringSelectMenu()){
			const guild = ix.guild; if(!guild) return ix.reply({ content:'Server not available.', ephemeral:true });
			if(!isModuleEnabled(guild.id, 'roles')) return ix.reply({ content:'Reaction Roles module is disabled in this server.', ephemeral:true });
			const member = await guild.members.fetch(ix.user.id).catch(()=>null); if(!member) return ix.reply({ content:'Member not found.', ephemeral:true });
			const menu = getReactionMenuByMessageId(ix.message?.id);
			if(!menu) return ix.reply({ content:'Menu not found.', ephemeral:true });
			const selected = new Set(ix.values || []);
			const allRoleIds = (menu.roles||[]).map(r=> r.role_id).filter(Boolean);
			// allowed/ignored enforcement
			try{
				const allowList = String(menu.allowed_roles||'').split(',').map(s=>s.trim()).filter(Boolean);
				const ignoreList = String(menu.ignored_roles||'').split(',').map(s=>s.trim()).filter(Boolean);
				if(ignoreList.length && ignoreList.some(id=> member.roles.cache.has(id))){
					return ix.reply({ content:'You cannot use this menu.', ephemeral:true });
				}
				if(allowList.length && !allowList.some(id=> member.roles.cache.has(id))){
					return ix.reply({ content:'You don\'t meet the requirements.', ephemeral:true });
				}
			}catch(_){ }
			const toAdd = allRoleIds.filter(id=> selected.has(id) && !member.roles.cache.has(id));
			const toRemove = allRoleIds.filter(id=> !selected.has(id) && member.roles.cache.has(id));
			try{
				if(toRemove.length) await member.roles.remove(toRemove).catch(()=>{});
				if(toAdd.length) await member.roles.add(toAdd).catch(()=>{});
				await ix.reply({ content:'Updated your roles.', ephemeral:true });
			}catch(e){
				try{ await ix.reply({ content:'Failed: '+(e?.message||'Unknown'), ephemeral:true }); }catch(_){ }
				try{ addWebLog({ guild_id: guild.id, user_id: ix.user?.id, username: ix.user?.username, action: `Select menu update failed: ${e?.message||'Unknown'}`, action_type: 'dashboard' }); }catch(_){ }
			}
		}
	}catch(e){ /* swallow */ }
}