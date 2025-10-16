
import { layout } from './layout.js';

export function renderWelcomeSettings({ guild, guildId, textChannels, settings, saved=false, recentLogs=[], botNickname='' }){
  const esc = (s='') => String(s).replace(/[&<>\"]/g, t=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[t]));
  const title = guild ? esc(guild.name) : `Guild ${guildId}`;
  const channelOptions = textChannels.map(c => `<option value="${c.id}" ${String(settings.channel_id || '')===String(c.id)?'selected':''}>#${esc(c.name)}</option>`).join('');
  let embedObj = null; try { embedObj = settings.embed_json ? JSON.parse(settings.embed_json) : null; } catch(e){ embedObj = null; }

  const body = `
    <style>
      /* Welcome page fluid layout */
  .w-grid{ display:grid; grid-template-columns: minmax(0,1fr) 420px; column-gap:16px; row-gap:16px; max-width: 1280px }
  @media (max-width: 1280px){ .w-grid{ grid-template-columns: minmax(0,1fr) 380px } }
  @media (max-width: 1100px){ .w-grid{ grid-template-columns: 1fr } }
      @media (max-width: 900px){ .w-grid{ grid-template-columns: 1fr } }
  .w-grid .card{ width:100%; padding:20px 22px; border-radius:8px; background:#181a20 }
  .modules > .card + .card{ margin-top:12px }
      .modules .card textarea{ min-height: 100px }
  .modules > div > .settings-group{ border:none; background:transparent; padding:0 }
  /* Hover effect for other left cards too */
  .modules .card{ border:1px solid rgba(255,255,255,.06); transition:.18s border-color, .18s transform, .18s background }
  .modules .card:hover{ border-color:#8b5cf6; transform: translateY(-2px); background: rgba(21,24,34,.62) }
  /* Inputs look */
  .w-grid select, .w-grid textarea, .w-grid input[type="text"]{ background:#0f1216; color:#e5e7eb; border:1px solid #262b35; border-radius:8px; padding:10px 12px; outline:none; width:100% }
  .w-grid select{ height:38px }
  .w-grid textarea{ min-height:110px; resize:vertical }
  .w-grid .label{ color:#c9cdd4; font-size:12px; text-transform:none; margin-bottom:6px; display:inline-block }
  .subtle{ color:#9aa3ae; font-size:11px; letter-spacing:.08em; text-transform:uppercase }
      /* Dyno-like settings group */
  .settings-group{ display:flex; flex-wrap:wrap; justify-content:space-between; margin: 6px 0 12px; gap:16px }
  .settings-content{ background:#181a20; color:#fff; border-radius:8px; padding:22px; margin:0; clear:both; vertical-align:top; font-family:"Inter",Arial,Helvetica; display:flex; flex-direction:column; border:1px solid rgba(255,255,255,.06); transition:.18s border-color, .18s transform, .18s background }
  .settings-content:hover{ border-color:#8b5cf6; transform: translateY(-2px); background: rgba(21,24,34,.62) }
  .settings-content.is-half{ flex:1 1 calc(50% - 8px); margin-top:0; min-height:160px }
      .settings-content.is-half:first-child{ margin-left:0 }
      .settings-content.is-half:last-child{ margin-right:0 }
  .settings-content .title.is-5{ margin:0 0 16px; color:#fff; text-transform:uppercase; letter-spacing:.06em; font-size:12px }
      .is-flex{ display:flex }
  .is-flex-half{ width:50%; padding:6px 4px }
  @media (max-width: 720px){ .is-flex-half{ width:100% } }
  /* Message Type radios */
  .settings-content .control.rich-toggle.radio{ display:flex; align-items:center; justify-content:space-between; padding:8px 6px; border-radius:6px }
  .settings-content .control.rich-toggle.radio input[type="radio"]{ position:absolute; opacity:0; pointer-events:none }
  .settings-content .control.rich-toggle.radio label.checkbox{ position:relative; padding-left:22px; cursor:pointer; user-select:none; color:#9aa3ae; font-size:12px; letter-spacing:.06em; 
    /* variables for radio indicator geometry */
    --r-left: 0px; 
    --r-top: 2px; 
    --r-size: 14px; 
  }
  .settings-content .control.rich-toggle.radio label.checkbox span{ text-transform:uppercase; display:inline-block; padding:2px 6px; border-radius:4px; transition: background-color .15s ease, color .15s ease, box-shadow .15s ease }
  /* Dyno-like blue text chip on hover/focus */
  .settings-content .control.rich-toggle.radio:hover label.checkbox span,
  .settings-content .control.rich-toggle.radio:focus-within label.checkbox span{ background:#2563eb; color:#ffffff; box-shadow:0 0 0 2px rgba(37,99,235,.15) }
  .settings-content .control.rich-toggle.radio label.checkbox::before{ content:""; position:absolute; left:var(--r-left); top:var(--r-top); width:var(--r-size); height:var(--r-size); box-sizing:border-box; border:2px solid #334155; border-radius:50%; background:transparent; transition:border-color .15s ease, background-color .15s ease, box-shadow .15s ease }
  .settings-content .control.rich-toggle.radio label.checkbox::after{ content:""; position:absolute; left:calc(var(--r-left) + var(--r-size) / 2); top:calc(var(--r-top) + var(--r-size) / 2); transform:translate(-50%,-50%); width:6px; height:6px; border-radius:50%; background:transparent; transition:background-color .15s ease }
  .settings-content .control.rich-toggle.radio:hover label.checkbox::before{ border-color:#3e4b5c }
  /* Hover glow for radio circle (unchecked state) */
  .settings-content .control.rich-toggle.radio:hover label.checkbox::before,
  .settings-content .control.rich-toggle.radio:focus-within label.checkbox::before{ box-shadow: 0 0 0 4px rgba(139, 92, 246, .14), 0 0 12px rgba(139, 92, 246, .22) }
  .settings-content .control.rich-toggle.radio input[type="radio"]:checked + label.checkbox{ color:#e5e7eb }
  .settings-content .control.rich-toggle.radio input[type="radio"]:checked + label.checkbox::before{ border-color:#e05252; background:#e05252 }
  /* Stronger glow when checked and hovered/focused */
  .settings-content .control.rich-toggle.radio:hover input[type="radio"]:checked + label.checkbox::before,
  .settings-content .control.rich-toggle.radio:focus-within input[type="radio"]:checked + label.checkbox::before{ box-shadow: 0 0 0 4px rgba(224, 82, 82, .18), 0 0 12px rgba(224, 82, 82, .28) }
  .settings-content .control.rich-toggle.radio input[type="radio"]:checked + label.checkbox::after{ background:#0b0e14 }
  .settings-content .control.rich-toggle.radio .help-icon{ color:#5a6472 }
  
  /* Toggle switch (Enable Module) */
  .switch{ display:inline-block; width:42px; height:24px; background:#2b2f36; border-radius:999px; position:relative }
  .switch input{ display:none }
  .switch .knob{ position:absolute; top:3px; left:3px; width:18px; height:18px; border-radius:50%; background:#cbd5e1; transition:all .18s }
  .switch.on{ background:linear-gradient(90deg,#7c3aed,#a855f7) }
  .switch.on .knob{ left:21px; background:white }
  .topbar .toggle-row{ display:flex; align-items:center; gap:10px }
  .crumbs{ font-size:24px; font-weight:800 }
  .crumbs .crumb{ color:#8b5cf6; text-decoration:none }
  .crumbs .crumb:hover{ color:#a78bfa; text-decoration:underline }
  .crumbs .sep{ opacity:.5 }
  /* Embed builder */
  .embed-grid{ display:grid; grid-template-columns: 1fr 1fr; gap:12px }
  .embed-grid .full{ grid-column: 1 / span 2 }
  .embed-color-row{ display:flex; align-items:center; gap:10px }
  .embed-color-row input[type="color"]{ -webkit-appearance:none; appearance:none; width:28px; height:28px; border-radius:6px; border:1px solid #2a2f38; padding:0; background:transparent }
  .embed-color-row input[type="text"]{ width:120px }
  .embed-fields{ margin-top:8px }
  .embed-field{ background:#0f1216; border:1px solid #262b35; border-radius:8px; padding:10px; margin-top:8px }
  .embed-field .row{ display:flex; gap:8px }
  .embed-field .row > input{ flex:1 }
  .link-like{ color:#8b5cf6; cursor:pointer; font-size:13px; user-select:none }
  /* URL invalid state */
  input.is-invalid{ border-color:#ef4444 !important; box-shadow: inset 0 0 0 1px rgba(239,68,68,.25) }
  /* Embed preview */
  .discord-embed{ background:#0b1118; border-radius:8px; padding:12px; position:relative; border:1px solid #10151c }
  .discord-embed .e-title{ font-weight:600; color:#e5e7eb; margin-bottom:4px }
  .discord-embed .e-title a{ color:#60a5fa; text-decoration:none }
  .discord-embed .e-desc{ color:#98a0ab; white-space:pre-wrap }
  .discord-msg{ padding:12px; background:#071018; border-radius:8px }
  .dm-header{ display:flex; align-items:center; gap:12px }
  .dm-avatar{ width:32px; height:32px; border-radius:50%; background:linear-gradient(180deg,#1f3a5a,#163449); display:flex; align-items:center; justify-content:center; font-weight:700; color:#fff; font-size:12px }
  .dm-name{ color:#60a5fa; font-weight:700; margin-right:6px }
  .dm-badge{ background:#5865f21a; color:#a5b4fc; border:1px solid #5865f233; border-radius:4px; padding:1px 4px; font-size:10px; margin-right:6px }
  .dm-time{ color:#98a0ab; font-size:12px }
  .dm-content{ color:#e5e7eb; margin:8px 0 10px }
  .discord-embed .e-author{ display:flex; align-items:center; gap:8px; margin-bottom:6px; color:#cbd5e1 }
  .discord-embed .e-author img{ width:20px; height:20px; border-radius:50%; object-fit:cover }
  .discord-embed .e-fields{ display:grid; grid-template-columns: 1fr; gap:8px; margin-top:8px }
  .discord-embed .e-fields.inline{ grid-template-columns: repeat(2, minmax(0,1fr)) }
  .discord-embed .e-field{ background:#0f1216; border:1px solid #1a212c; border-radius:6px; padding:8px }
  .discord-embed .e-field .name{ font-weight:600; color:#cbd5e1 }
  .discord-embed .e-field .value{ color:#9aa3ae; white-space:pre-wrap }
  .discord-embed .e-thumb{ position:absolute; top:12px; right:12px; width:80px; height:80px; border-radius:4px; object-fit:cover; display:none }
  .discord-embed .e-thumb-fallback{ position:absolute; top:12px; right:12px; width:80px; height:80px; border-radius:4px; display:none; align-items:center; justify-content:center; border:1px dashed #2a3442; color:#9aa3ae; font-size:14px }
  .discord-embed .e-image{ display:none; width:100%; max-height:320px; object-fit:cover; border-radius:6px; margin-top:8px }
  .discord-embed .e-image-fallback{ display:none; width:100%; height:120px; border:1px dashed #2a3442; border-radius:6px; margin-top:8px; align-items:center; justify-content:center; color:#9aa3ae }
  .discord-embed .e-footer{ display:flex; align-items:center; gap:8px; margin-top:10px; color:#9aa3ae; font-size:12px }
  .discord-embed .e-footer img{ width:20px; height:20px; border-radius:50%; object-fit:cover }
  /* Utility */
  .hidden{ display:none !important }
  .previewCard{ display:block }
  .visible{ display:block !important }
  /* Theme tiles */
  .theme-grid{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px }
  .theme-tile{ position:relative; border-radius:10px; overflow:hidden; border:1px solid #202530; cursor:pointer; background:#0b1118 }
  .theme-tile img{ display:block; width:100%; height:88px; object-fit:cover }
  .theme-ov{ position:absolute; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:8px; background:linear-gradient(180deg,rgba(0,0,0,0) 30%, rgba(0,0,0,.55)); color:#e5e7eb; font-size:12px; opacity:0; transition:opacity .18s }
  .theme-actions{ position:absolute; top:8px; right:8px; display:flex; gap:6px; opacity:0; transition:opacity .18s }
  .theme-actions .btn-ico{ border:none; background:rgba(17,24,39,.75); color:#e5e7eb; padding:6px 8px; border-radius:8px; font-size:12px }
  .theme-tile:hover .theme-ov, .theme-tile:hover .theme-actions{ opacity:1 }
  .theme-tile.is-selected{ outline:2px solid #8b5cf6; box-shadow:0 0 0 2px rgba(139,92,246,.25) inset }
    </style>
    <div class="topbar">
  <div class="brand"><div class="crumbs" style="display:flex;gap:8px;align-items:center"><a class="crumb" href="/modules?guild_id=${guildId}">Modules</a><span class="sep">/</span><span>Welcome</span></div></div>
      <div style="display:flex;gap:16px;align-items:center">
        <div class="toggle-row">
          <span class="muted" style="font-size:13px">Enable Module</span>
          <label class="switch ${settings.enabled ? 'on':''}">
            <input id="header-enabled" type="checkbox" name="enabled" ${settings.enabled ? 'checked' : ''} />
            <span class="knob"></span>
          </label>
        </div>
  <button class="btn" type="button" id="header-publish">Publish</button>
  <button class="btn" type="button" id="header-test-welcome">Send test</button>
        <a class="btn" href="/dashboard?guild_id=${guildId}">Back</a>
      </div>
    </div>
        <div>
          <div class="w-grid">
        <div class="modules">
          <div style="padding:0;margin:0">
            <form id="main-welcome-form" method="post" action="/dashboard/guild/${guildId}/welcome">
              <div class="settings-group">
                <div class="settings-content is-half">
                  <h3 class="title is-5">Message Type</h3>
                  <div class="is-flex" style="flex-wrap: wrap;">
                    <div class="control rich-toggle radio is-flex-half">
                      <span>
                        <input id="mt-message" type="radio" name="message_type" value="message" ${settings.message_type==='message'?'checked':''} />
                        <label class="checkbox" for="mt-message"><span>Message</span></label>
                      </span>
                      <span class="help-icon"><a><span class="icon is-help"><i class="fa fa-question-circle"></i></span></a></span>
                    </div>
                    <div class="control rich-toggle radio is-flex-half">
                      <span>
                        <input id="mt-embed" type="radio" name="message_type" value="embed" ${settings.message_type==='embed'?'checked':''} />
                        <label class="checkbox" for="mt-embed"><span>Embed</span></label>
                      </span>
                      <span class="help-icon"><a><span class="icon is-help"><i class="fa fa-question-circle"></i></span></a></span>
                    </div>
                    <div class="control rich-toggle radio is-flex-half">
                      <span>
                        <input id="mt-embed-text" type="radio" name="message_type" value="embed_text" ${settings.message_type==='embed_text'?'checked':''} />
                        <label class="checkbox" for="mt-embed-text"><span>Embed and text</span></label>
                      </span>
                      <span class="help-icon"><a><span class="icon is-help"><i class="fa fa-question-circle"></i></span></a></span>
                    </div>
                    <div class="control rich-toggle radio is-flex-half">
                      <span>
                        <a class="checkbox" href="/dashboard/guild/${guildId}/welcome-channel"><span>Welcome Channel</span></a>
                      </span>
                      <span class="help-icon"><a href="/dashboard/guild/${guildId}/welcome-channel"><span class="icon is-help"><i class="fa fa-external-link"></i></span></a></span>
                    </div>
                  </div>
                </div>
                <div class="settings-content is-half">
                  <h3 class="title is-5">Channel Options</h3>
                  <label class="label"><span>Welcome Channel</span></label>
                  <select name="channel_id">
                    <option value="">(Select channel)</option>
                    ${channelOptions}
                  </select>
                  <div style="margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,.06)">
                    <label class="label"><span>Bot Nickname (optional)</span></label>
                    <div id="bot-nick-form" data-action="/dashboard/guild/${guildId}/bot/nickname" style="display:flex; gap:8px; align-items:center">
                      <input id="bot-nick-input" type="text" name="nickname" placeholder="e.g. Forge Hammer" value="${esc(botNickname || '')}" style="max-width:260px"/>
                      <button class="btn" id="bot-nick-update" type="button">Update</button>
                    </div>
                    <div class="subtle" style="margin-top:6px">Works when your bot is connected to Discord and in this server.</div>
                  </div>
                </div>
              </div>

              <div id="message-card" class="card">
                <label class="label">Message</label>
                <textarea id="message-text" name="message_text" placeholder="e.g. Welcome {user} to {server}!">${esc(settings.message_text || '')}</textarea>
                <div class="actions" style="margin-top:12px"><button class="btn primary" type="submit">Save</button></div>
              </div>

              <div id="embed-card" class="card hidden">
                <div class="subtle">* All fields are optional</div>
                <div class="embed-grid" style="margin-top:10px">
                  <div class="full">
                    <label class="label">Color</label>
                    <div class="embed-color-row">
                      <input id="emb-color-picker" type="color" value="${esc((embedObj && embedObj.color && /^#?[0-9a-f]{6}$/i.test(embedObj.color) ? (embedObj.color.startsWith('#')?embedObj.color:'#'+embedObj.color) : '#5865F2'))}" />
                      <input id="emb-color-text" type="text" placeholder="#5865F2" value="${esc((embedObj && embedObj.color) ? (typeof embedObj.color==='number'?('#'+(embedObj.color>>>0).toString(16).padStart(6,'0')): embedObj.color): '')}" />
                    </div>
                  </div>
                  <div>
                    <label class="label">Title</label>
                    <input id="emb-title" type="text" placeholder="Enter Title" value="${esc(embedObj?.title || '')}" />
                  </div>
                  <div>
                    <label class="label">Title URL</label>
                    <input id="emb-title-url" type="text" placeholder="Enter URL" value="${esc(embedObj?.title_url || '')}" />
                  </div>
                  <div class="full">
                    <label class="label">Description</label>
                    <textarea id="emb-description" placeholder="Enter Description">${esc(embedObj?.description || '')}</textarea>
                  </div>
                  <div>
                    <label class="label">Author Name</label>
                    <input id="emb-author-name" type="text" placeholder="Enter Name" value="${esc(embedObj?.author_name || '')}" />
                  </div>
                  <div>
                    <label class="label">Author Icon</label>
                    <input id="emb-author-icon" type="text" placeholder="Enter URL" value="${esc(embedObj?.author_icon || '')}" />
                  </div>
                  <div>
                    <label class="label">Thumbnail</label>
                    <input id="emb-thumbnail" type="text" placeholder="Enter URL" value="${esc(embedObj?.thumbnail || '')}" />
                  </div>
                  <div>
                    <label class="label">Image</label>
                    <input id="emb-image" type="text" placeholder="Enter URL" value="${esc(embedObj?.image || '')}" />
                  </div>
                  <div>
                    <label class="label">Footer</label>
                    <input id="emb-footer-text" type="text" placeholder="Enter Text" value="${esc(embedObj?.footer_text || '')}" />
                  </div>
                  <div>
                    <label class="label">Footer Icon</label>
                    <input id="emb-footer-icon" type="text" placeholder="Enter URL" value="${esc(embedObj?.footer_icon || '')}" />
                  </div>
                  <div class="full">
                    <label class="label">Fields</label>
                    <div id="emb-fields" class="embed-fields"></div>
                    <div style="margin-top:8px"><span id="emb-add-field" class="link-like">+ Add Field</span></div>
                  </div>
                </div>
                <input type="hidden" name="embed_json" id="embed-json-hidden" value="${esc(settings.embed_json || '')}" />
                <input type="hidden" id="embed-json-debug" value="${esc(settings.embed_json || '')}" />
                <input type="hidden" name="bot_nickname" id="bot-nickname-hidden" value="${esc(botNickname || '')}" />
              </div>

              <!-- Welcome Banner builder moved to Welcome Channel page -->
            </form>

            <script>
              (function(){
                const btn = document.getElementById('header-publish');
                const main = document.getElementById('main-welcome-form');
                const testBtn = document.getElementById('header-test-welcome');
                const headerEnabled = document.getElementById('header-enabled');
                const messageCard = document.getElementById('message-card');
                const embedCard = document.getElementById('embed-card');
                const radios = Array.from(document.querySelectorAll('input[name="message_type"]'));
                const colorPicker = document.getElementById('emb-color-picker');
                const colorText = document.getElementById('emb-color-text');
                const fieldsWrap = document.getElementById('emb-fields');
                const addFieldBtn = document.getElementById('emb-add-field');
                const hiddenEmbed = document.getElementById('embed-json-hidden');
                const botNickInput = document.getElementById('bot-nick-input');
                const botNickForm = document.getElementById('bot-nick-form');
                const botNickBtn = document.getElementById('bot-nick-update');
                const botNickHidden = document.getElementById('bot-nickname-hidden');
                const bannerCard = document.getElementById('banner-card');
                const banBg = document.getElementById('ban-bg-url');
                const banTitle = document.getElementById('ban-title');
                const banSub = document.getElementById('ban-sub');
                const banCanvas = document.getElementById('ban-canvas');
                const bannerHidden = document.getElementById('banner-json-hidden');
                const bannerDataHidden = document.getElementById('banner-data-hidden');
                const themeGrid = document.getElementById('theme-grid');
                function getPreviewEls(){
                  return {
                    prevMsg: document.getElementById('preview-message-card'),
                    prevEmb: document.getElementById('preview-embed-card'),
                    epTitle: document.getElementById('ep-title'),
                    epDesc: document.getElementById('ep-desc'),
                    epFields: document.getElementById('ep-fields'),
                    embedBox: document.getElementById('discord-embed-box')
                  };
                }

                function syncColorInputs(fromPicker){
                  if(!colorPicker || !colorText) return;
                  if(fromPicker){ colorText.value = colorPicker.value; }
                  else {
                    const v = colorText.value.trim();
                    if(/^#?[0-9a-fA-F]{6}$/.test(v)) colorPicker.value = v.startsWith('#')?v:('#'+v);
                  }
                }
                function isValidUrl(u){ try{ new URL(u); return true; }catch(e){ return false; } }
                function renderEmbedPreview(){
                  const obj = buildEmbedJson();
                  const mt = (radios.find(r=>r.checked)?.value)||'message';
                  const messageTextEl = document.getElementById('message-text');
                  const msgText = (messageTextEl?.value || '').trim();
                  const isEmbedObjEmpty = ()=>{
                    const hasFields = Array.isArray(obj.fields) && obj.fields.length>0;
                    return !((obj.title && obj.title.trim()) || (obj.description && obj.description.trim()) || hasFields || obj.title_url || obj.author_name || obj.author_icon || obj.thumbnail || obj.image || obj.footer_text || obj.footer_icon || obj.color);
                  };
                  function renderOne(suffix){
                    const epTitle = document.getElementById('ep-title'+suffix);
                    const epDesc = document.getElementById('ep-desc'+suffix);
                    const epFields = document.getElementById('ep-fields'+suffix);
                    const embedBox = document.getElementById('discord-embed-box'+suffix);
                    const epAuthor = document.getElementById('ep-author'+suffix);
                    const epThumb = document.getElementById('ep-thumb'+suffix);
                    const epThumbFallback = document.getElementById('ep-thumb-fallback'+suffix);
                    const epImage = document.getElementById('ep-image'+suffix);
                    const epImageFallback = document.getElementById('ep-image-fallback'+suffix);
                    const epFooter = document.getElementById('ep-footer'+suffix);
                    if(!epTitle || !epDesc || !epFields || !embedBox) return;

                    // title and optional url (with placeholder)
                    epTitle.innerHTML = '';
                    const titleText = obj.title || 'Title';
                    if(obj.title_url){
                      const a = document.createElement('a');
                      a.href = obj.title_url; a.textContent = titleText; a.target = '_blank';
                      epTitle.appendChild(a);
                    } else {
                      epTitle.textContent = titleText;
                    }
                    // description (with server-matching fallback)
                    if (mt==='embed' && isEmbedObjEmpty() && msgText) {
                      epDesc.textContent = msgText; // server uses message_text as embed description fallback
                    } else {
                      epDesc.textContent = obj.description || 'Description';
                    }
                    // author (placeholder)
                    if(epAuthor){
                      epAuthor.innerHTML = '';
                      if(obj.author_icon){ const img = document.createElement('img'); img.src = obj.author_icon; img.alt=''; epAuthor.appendChild(img); }
                      const span = document.createElement('span'); span.textContent = obj.author_name || 'Author Name'; epAuthor.appendChild(span);
                    }
                    // color left bar via inset box shadow
                    let c = (obj.color||'').toString();
                    if(/^#?[0-9a-fA-F]{6}$/.test(c)){
                      if(!c.startsWith('#')) c = '#'+c;
                      embedBox.style.boxShadow = 'inset 4px 0 0 0 ' + c;
                    } else {
                      embedBox.style.boxShadow = 'inset 4px 0 0 0 #5865F2';
                    }
                    // fields (placeholder)
                    epFields.innerHTML = '';
                    const list = Array.isArray(obj.fields) && obj.fields.length ? obj.fields : [{ name:'Fields', value:'Fields value', inline:false }];
                    let anyInline = false;
                    for(const f of list){ if(f && f.inline) { anyInline = true; break; } }
                    epFields.classList.toggle('inline', anyInline);
                    for(const f of list){
                      const div = document.createElement('div');
                      div.className = 'e-field';
                      const n = document.createElement('div'); n.className = 'name'; n.textContent = f.name || '';
                      const v = document.createElement('div'); v.className = 'value'; v.textContent = f.value || '';
                      div.appendChild(n); div.appendChild(v); epFields.appendChild(div);
                    }
                    // thumbnail
                    if(epThumb){
                      if(obj.thumbnail && isValidUrl(obj.thumbnail)){
                        epThumb.onerror = ()=>{ epThumb.style.display='none'; if(epThumbFallback) epThumbFallback.style.display='flex'; };
                        epThumb.onload = ()=>{ epThumb.style.display='block'; if(epThumbFallback) epThumbFallback.style.display='none'; };
                        epThumb.src = obj.thumbnail; // triggers load/error
                      } else {
                        epThumb.removeAttribute('src'); epThumb.style.display='none'; if(epThumbFallback) epThumbFallback.style.display = obj.thumbnail ? 'flex' : 'none';
                      }
                    }
                    // image
                    if(epImage){
                      if(obj.image && isValidUrl(obj.image)){
                        epImage.onerror = ()=>{ epImage.style.display='none'; if(epImageFallback) epImageFallback.style.display='flex'; };
                        epImage.onload = ()=>{ epImage.style.display='block'; if(epImageFallback) epImageFallback.style.display='none'; };
                        epImage.src = obj.image;
                      } else {
                        epImage.removeAttribute('src'); epImage.style.display='none'; if(epImageFallback) epImageFallback.style.display = obj.image ? 'flex' : 'none';
                      }
                    }
                    // footer (placeholder)
                    if(epFooter){
                      epFooter.innerHTML = '';
                      if(obj.footer_icon){ const img = document.createElement('img'); img.src=obj.footer_icon; img.alt=''; epFooter.appendChild(img); }
                      const span = document.createElement('span'); span.textContent = obj.footer_text || 'Footer'; epFooter.appendChild(span);
                    }
                    // For embed_text, hide the embed if it would be empty (matches server which omits empty embeds)
                    if (mt==='embed_text') {
                      const empty = isEmbedObjEmpty();
                      if (embedBox) embedBox.style.display = empty ? 'none' : '';
                    } else {
                      if (embedBox) embedBox.style.display = '';
                    }
                  }
                  renderOne('');
                  renderOne('-2');

                  // Mark invalid URL inputs
                  const urlIds = ['emb-title-url','emb-author-icon','emb-thumbnail','emb-image','emb-footer-icon'];
                  for(const id of urlIds){
                    const el = document.getElementById(id);
                    if(!el) continue;
                    const v = (el.value||'').trim();
                    if(v && !isValidUrl(v)) el.classList.add('is-invalid'); else el.classList.remove('is-invalid');
                  }
                }
                if(colorPicker && colorText){
                  colorPicker.addEventListener('input', ()=>{ syncColorInputs(true); renderEmbedPreview(); });
                  colorText.addEventListener('input', ()=>{ syncColorInputs(false); renderEmbedPreview(); });
                  // Initialize the text field with the picker's current value if empty
                  try { if (!colorText.value) { colorText.value = colorPicker.value; } } catch(e){}
                }

                // Update preview on main embed inputs typing
                function bindInput(id){ const el = document.getElementById(id); if(el){ el.addEventListener('input', renderEmbedPreview);} }
                ['emb-title','emb-title-url','emb-description','emb-author-name','emb-author-icon','emb-thumbnail','emb-image','emb-footer-text','emb-footer-icon'].forEach(bindInput);

                if (testBtn) {
                  testBtn.addEventListener('click', async ()=>{
                    // Ensure the selected channel is saved so the test has a target
                    try {
                      const form = new FormData(main);
                      // quick save minimal fields (channel_id, message_type, message_text, embed_json)
                      const body = new URLSearchParams();
                      ['channel_id','message_type','message_text','embed_json','bot_nickname'].forEach(k=>{ if(form.get(k)!=null) body.set(k, String(form.get(k)||'')); });
                      await fetch(main.action, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-Requested-With':'XMLHttpRequest' }, body });
                    } catch(e) {}
                    try{
                      const resp = await fetch('/dashboard/guild/${guildId}/welcome/test', { method:'POST', headers:{ 'X-Requested-With':'XMLHttpRequest' } });
                      if(!resp.ok){ const t = await resp.text(); throw new Error(t||('HTTP '+resp.status)); }
                      alert('Test welcome sent to the configured channel.');
                    }catch(e){ alert(e?.message||'Failed to send test'); }
                  });
                }

                function fieldRow(data){
                  const wrap = document.createElement('div');
                  wrap.className = 'embed-field';

                  const row = document.createElement('div');
                  row.className = 'row';

                  const inName = document.createElement('input');
                  inName.type = 'text';
                  inName.placeholder = 'Name';
                  inName.value = (data && data.name) ? String(data.name) : '';

                  const inValue = document.createElement('input');
                  inValue.type = 'text';
                  inValue.placeholder = 'Value';
                  inValue.value = (data && data.value) ? String(data.value) : '';

                  row.appendChild(inName);
                  row.appendChild(inValue);

                  const meta = document.createElement('div');
                  meta.style.display = 'flex';
                  meta.style.alignItems = 'center';
                  meta.style.gap = '8px';
                  meta.style.marginTop = '8px';

                  const label = document.createElement('label');
                  label.style.fontSize = '12px';
                  label.style.color = '#9aa3ae';
                  const inlineCb = document.createElement('input');
                  inlineCb.type = 'checkbox';
                  inlineCb.style.marginRight = '6px';
                  inlineCb.checked = !!(data && data.inline);
                  label.appendChild(inlineCb);
                  label.appendChild(document.createTextNode('Inline'));

                  const remove = document.createElement('span');
                  remove.className = 'link-like';
                  remove.dataset.act = 'remove';
                  remove.textContent = 'Remove';
                  remove.style.marginLeft = 'auto';
                  remove.addEventListener('click', ()=>wrap.remove());

                  meta.appendChild(label);
                  meta.appendChild(remove);

                  wrap.appendChild(row);
                  wrap.appendChild(meta);
                  // update preview on change
                  inName.addEventListener('input', renderEmbedPreview);
                  inValue.addEventListener('input', renderEmbedPreview);
                  inlineCb.addEventListener('change', renderEmbedPreview);
                  return wrap;
                }
                if(fieldsWrap){
                  try{
                    const initialStr = ${JSON.stringify(JSON.stringify(embedObj?.fields||[]))};
                    const initial = JSON.parse(initialStr);
                    if(Array.isArray(initial)){
                      for(const f of initial){ fieldsWrap.appendChild(fieldRow(f)); }
                    }
                  }catch(e){}
                }
                if(addFieldBtn && fieldsWrap){
                  addFieldBtn.addEventListener('click', ()=>{
                    if(fieldsWrap.children.length>=25) return; // Discord limit
                    fieldsWrap.appendChild(fieldRow());
                  });
                }

                function buildEmbedJson(){
                  const obj = {};
                  function val(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }
                  let c = val('emb-color-text');
                  if(!c && colorPicker) { try{ c = (colorPicker.value||'').trim(); }catch(e){} }
                  if(c) obj.color = c;
                  const title = val('emb-title'); if(title) obj.title = title;
                  const title_url = val('emb-title-url'); if(title_url) obj.title_url = title_url;
                  const desc = val('emb-description'); if(desc) obj.description = desc;
                  const an = val('emb-author-name'); if(an) obj.author_name = an;
                  const ai = val('emb-author-icon'); if(ai) obj.author_icon = ai;
                  const th = val('emb-thumbnail'); if(th) obj.thumbnail = th;
                  const im = val('emb-image'); if(im) obj.image = im;
                  const ft = val('emb-footer-text'); if(ft) obj.footer_text = ft;
                  const fi = val('emb-footer-icon'); if(fi) obj.footer_icon = fi;
                  if(fieldsWrap){
                    const arr = [];
                    const kids = Array.from(fieldsWrap.children);
                    for(const k of kids){
                      const ins = k.querySelectorAll('input');
                      const name = ins[0]?.value?.trim();
                      const value = ins[1]?.value?.trim();
                      const inline = k.querySelector('input[type="checkbox"]')?.checked || false;
                      if(name && value) arr.push({ name, value, inline });
                    }
                    if(arr.length) obj.fields = arr;
                  }
                  return obj;
                }

                function ensureEmbedHidden(){
                  if(!hiddenEmbed) return;
                  const mt = (radios.find(r=>r.checked)?.value)||'message';
                  if(mt==='embed' || mt==='embed_text'){
                    const obj = buildEmbedJson();
                    const s = JSON.stringify(obj);
                    hiddenEmbed.value = s;
                    const dbg = document.getElementById('embed-json-debug'); if(dbg) dbg.value = s;
                  } else {
                    hiddenEmbed.value = '';
                  }
                }

                function ensureBotNickHidden(){
                  if(!botNickHidden) return;
                  const name = botNickInput ? (botNickInput.value || '').trim() : '';
                  botNickHidden.value = name;
                }

                function updateVisibility(){
                  const { prevMsg, prevEmb } = getPreviewEls();
                  const combined = document.getElementById('preview-combined-embed');
                  const mt = (radios.find(r=>r.checked)?.value)||'message';
                  try { console.debug('[Welcome] updateVisibility ->', mt, { hasPrevMsg: !!prevMsg, hasPrevEmb: !!prevEmb, hasCombined: !!combined }); } catch(e){}
                  const ensureVisible = (el)=>{
                    if(!el) return;
                    el.classList.remove('hidden');
                    el.classList.add('visible');
                    try{ el.style.removeProperty('display'); }catch(e){}
                    el.style.display = 'block';
                  };
                  // Editor cards: show Message editor for message and embed_text; show Embed builder for embed and embed_text
                  if(messageCard){ const hide = !(mt==='message' || mt==='embed_text'); messageCard.classList.toggle('hidden', hide); messageCard.classList.toggle('visible', !hide); messageCard.style.display = hide ? 'none' : 'block'; }
                  if(embedCard){ const hide = !(mt==='embed' || mt==='embed_text'); embedCard.classList.toggle('hidden', hide); embedCard.classList.toggle('visible', !hide); embedCard.style.display = hide ? 'none' : 'block'; }
                  if(bannerCard){ const hide = !(mt==='custom_image'); bannerCard.classList.toggle('hidden', hide); bannerCard.classList.toggle('visible', !hide); bannerCard.style.display = hide ? 'none' : 'block'; }
                  // Preview cards: show only the one matching the selected type. For embed_text, show combined preview (message + embed)
                  if(prevMsg){ const hide = !(mt==='message'); prevMsg.classList.toggle('hidden', hide); prevMsg.classList.toggle('visible', !hide); prevMsg.style.display = hide ? 'none' : 'block'; }
                  if(prevEmb){ const hide = !(mt==='embed'); prevEmb.classList.toggle('hidden', hide); prevEmb.classList.toggle('visible', !hide); prevEmb.style.display = hide ? 'none' : 'block'; }
                  if(combined){ const hide = !(mt==='embed_text'); combined.classList.toggle('hidden', hide); combined.classList.toggle('visible', !hide); combined.style.display = hide ? 'none' : 'block'; }
                  // Strong ensure-visible for the selected preview card
                  if(mt==='message') ensureVisible(prevMsg);
                  if(mt==='embed') ensureVisible(prevEmb);
                  if(mt==='embed_text') ensureVisible(combined);
                  // Move the visible preview to the top to avoid any collapsed spacing surprises
                  try{
                    const parent = (prevMsg||prevEmb||combined)?.parentElement;
                    const active = mt==='message' ? prevMsg : (mt==='embed' ? prevEmb : combined);
                    if(parent && active){ parent.prepend(active); }
                  }catch(e){}
                  try {
                    const s = (el)=> el ? getComputedStyle(el).display : 'missing';
                    console.debug('[Welcome] states:', { msg: s(prevMsg), emb: s(prevEmb), comb: s(combined) });
                  } catch(e){}
                  // sync alt message content
                  const msgAlt = document.getElementById('live-preview-alt');
                  const msgMain = document.getElementById('live-preview');
                  if(msgAlt && msgMain) msgAlt.textContent = msgMain.textContent;
                  // keep bot name in sync across previews
                  if(botNickInput){
                    const name = botNickInput.value.trim() || 'Forge Hammer';
                    document.querySelectorAll('.dm-name').forEach(el=> el.textContent = name);
                  }
                }
                // Bind radio events robustly
                if(radios && radios.length){
                  const fire = ()=>{ updateVisibility(); renderEmbedPreview(); };
                  radios.forEach(r=>{
                    r.addEventListener('change', fire);
                    r.addEventListener('click', fire);
                  });
                  // Event delegation fallback (in case radios are replaced by the browser/autofill)
                  document.addEventListener('change', (e)=>{
                    const t = e.target; if(t && t.name === 'message_type') fire();
                  });
                  updateVisibility();
                }
                const initPreviews = ()=>{ updateVisibility(); renderEmbedPreview(); setTimeout(()=>{ updateVisibility(); renderEmbedPreview(); }, 50); };
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', initPreviews);
                } else {
                  initPreviews();
                }

                // --- Welcome Banner (simple) ---
                function renderBanner(){
                  if(!banCanvas) return;
                  const ctx = banCanvas.getContext('2d');
                  const W = banCanvas.width, H = banCanvas.height;
                  ctx.fillStyle = '#0b1118'; ctx.fillRect(0,0,W,H);
                  const cfg = {
                    backgroundUrl: (banBg?.value||'').trim(),
                    title: (banTitle?.value||'').trim() || 'Welcome to {server}',
                    subtitle: (banSub?.value||'').trim() || 'Glad to have you, {username}!'
                  };
                  if(bannerHidden) bannerHidden.value = JSON.stringify(cfg);
                  if(cfg.backgroundUrl){
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = ()=>{
                      ctx.drawImage(img, 0, 0, W, H);
                      drawText(ctx, cfg);
                      try{ if(bannerDataHidden) bannerDataHidden.value = banCanvas.toDataURL('image/png'); }catch(e){}
                    };
                    img.onerror = ()=>{ drawText(ctx, cfg); };
                    img.src = cfg.backgroundUrl;
                  } else {
                    drawText(ctx, cfg);
                    try{ if(bannerDataHidden) bannerDataHidden.value = banCanvas.toDataURL('image/png'); }catch(e){}
                  }
                }
                function drawText(ctx, cfg){
                  const W = banCanvas.width, H = banCanvas.height;
                  // subtle overlay for readability
                  ctx.fillStyle = 'rgba(0,0,0,0.25)';
                  ctx.fillRect(0, 0, W, H);
                  ctx.textAlign = 'center';
                  // title
                  ctx.font = 'bold 56px Inter, Arial';
                  ctx.fillStyle = '#ffffff';
                  ctx.shadowColor = 'rgba(0,0,0,0.6)';
                  ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
                  ctx.fillText(cfg.title, W/2, H/2 - 12);
                  // subtitle
                  ctx.font = '500 28px Inter, Arial';
                  ctx.fillStyle = '#e5e7eb';
                  ctx.shadowBlur = 6; ctx.shadowOffsetY = 1;
                  ctx.fillText(cfg.subtitle, W/2, H/2 + 32);
                  // clear shadow
                  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                }
                [banBg, banTitle, banSub].forEach(el=>{ if(el) el.addEventListener('input', renderBanner); });
                renderBanner();

                // Theme grid (example themes; replace/add as you like)
                const themes = [
                  { id:'t1', url:'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop' },
                  { id:'t2', url:'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop' },
                  { id:'t3', url:'https://images.unsplash.com/photo-1503264116251-35a269479413?q=80&w=1200&auto=format&fit=crop' },
                  { id:'t4', url:'https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?q=80&w=1200&auto=format&fit=crop' }
                ];
                function renderThemes(){
                  if(!themeGrid) return;
                  themeGrid.innerHTML = '';
                  const current = (banBg?.value||'').trim();
                  for(const t of themes){
                    const tile = document.createElement('div'); tile.className = 'theme-tile' + (current===t.url?' is-selected':'');
                    const img = document.createElement('img'); img.src = t.url; img.alt='theme';
                    const ov = document.createElement('div'); ov.className = 'theme-ov'; ov.textContent = 'Recommended size ~ 960x360 (PNG/JPG/GIF)';
                    const actions = document.createElement('div'); actions.className = 'theme-actions';
                    const useBtn = document.createElement('button'); useBtn.type='button'; useBtn.className='btn-ico'; useBtn.textContent='Use';
                    const delBtn = document.createElement('button'); delBtn.type='button'; delBtn.className='btn-ico'; delBtn.textContent='✕'; delBtn.title='Clear';
                    actions.appendChild(useBtn); actions.appendChild(delBtn);
                    tile.appendChild(img); tile.appendChild(ov); tile.appendChild(actions);
                    useBtn.addEventListener('click', ()=>{ if(banBg){ banBg.value = t.url; renderBanner(); renderThemes(); } });
                    delBtn.addEventListener('click', ()=>{ if(banBg){ banBg.value=''; renderBanner(); renderThemes(); } });
                    themeGrid.appendChild(tile);
                  }
                }
                renderThemes();
                // Bot nickname: live preview + ajax submit
                function updateBotName(){
                  if(!botNickInput) return;
                  const name = botNickInput.value.trim() || 'Forge Hammer';
                  document.querySelectorAll('.dm-name').forEach(el=> el.textContent = name);
                  ensureBotNickHidden();
                }
                if(botNickInput){ botNickInput.addEventListener('input', updateBotName); updateBotName(); }
                if(botNickForm && botNickBtn){
                  botNickBtn.addEventListener('click', async ()=>{
                    const action = botNickForm.dataset.action;
                    const nickname = botNickInput ? (botNickInput.value||'').trim() : '';
                    try{ await fetch(action, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded', 'X-Requested-With':'XMLHttpRequest' }, body: new URLSearchParams({ nickname }) }); }catch(err){}
                    updateBotName();
                    try{ const t = document.createElement('div'); t.textContent = 'Nickname updated'; t.style.position='fixed'; t.style.right='18px'; t.style.top='18px'; t.style.background='linear-gradient(90deg,#7c3aed,#2563eb)'; t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='8px'; t.style.boxShadow='0 6px 18px rgba(0,0,0,.4)'; t.style.zIndex=9999; document.body.appendChild(t); setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity=0; setTimeout(()=>t.remove(),300); }, 1200); }catch(e){}
                  });
                }
                if(btn && main){
                  btn.addEventListener('click', ()=>{
                    // One-shot sync to ensure hidden embed JSON matches latest inputs
                    try { renderEmbedPreview(); } catch(e) {}
                    try { ensureEmbedHidden(); } catch(e) {}
                    let inp = main.querySelector('input[name="enabled"]');
                    if(!inp){ inp = document.createElement('input'); inp.type='hidden'; inp.name='enabled'; main.appendChild(inp); }
                    inp.value = headerEnabled && headerEnabled.checked ? 'on' : 'off';
                    // Let the submit handler run (so embed_json is computed reliably)
                    try{ localStorage.removeItem('welcome_draft_${guildId}'); }catch(e){}
                    if (typeof main.requestSubmit === 'function') main.requestSubmit(); else { ensureEmbedHidden(); ensureBotNickHidden(); main.submit(); }
                  });
                }

                const textarea = document.getElementById('message-text');
                const draftKey = 'welcome_draft_${guildId}';
                try{
                  if(textarea){
                    const existing = textarea.value && textarea.value.trim();
                    if(!existing){ const saved = localStorage.getItem(draftKey); if(saved) textarea.value = saved; }
                    textarea.addEventListener('input', ()=>{ try{ localStorage.setItem(draftKey, textarea.value); }catch(e){}; const pv = document.getElementById('live-preview'); if(pv) pv.textContent = textarea.value || 'Hey {user}, welcome to the server — enjoy your stay.'; const pv2=document.getElementById('live-preview-alt'); if(pv2) pv2.textContent = pv.textContent; });
                    if(main){ main.addEventListener('submit', ()=>{ try{ localStorage.removeItem(draftKey); }catch(e){}; ensureEmbedHidden(); ensureBotNickHidden(); }); }
                  }
                }catch(e){}

                try{ const wasSaved = ${saved ? 'true' : 'false'}; if(wasSaved){ const t = document.createElement('div'); t.textContent = 'Saved'; t.style.position='fixed'; t.style.right='18px'; t.style.top='18px'; t.style.background='linear-gradient(90deg,#7c3aed,#2563eb)'; t.style.color='white'; t.style.padding='10px 14px'; t.style.borderRadius='8px'; t.style.boxShadow='0 6px 18px rgba(0,0,0,.4)'; t.style.zIndex=9999; document.body.appendChild(t); setTimeout(()=>{ t.style.transition='opacity .3s'; t.style.opacity=0; setTimeout(()=>t.remove(),300); }, 1800); } }catch(e){}
              })();
            </script>

          </div>
        </div>

        <div>
          <div id="preview-message-card" class="card previewCard">
            <div class="previewTitle">Preview</div>
            <div class="previewDesc">This shows how the message will appear when a user joins.</div>
              <div class="discord-msg" style="margin-top:12px">
                <div class="dm-header">
                  <div class="dm-avatar">AV</div>
                  <div>
                    <span class="dm-name">${esc(botNickname || 'Forge Hammer')}</span>
                    <span class="dm-badge">BOT</span>
                    <span class="dm-time">Today at 12:53 AM</span>
                  </div>
                </div>
                <div class="dm-content" id="live-preview">${esc(settings.message_text || 'Message Content')}</div>
              </div>
              <div style="margin-top:10px;color:#98a0ab;font-size:13px">
                ${settings.last_sent_at ? `Last published: <b>${new Date(settings.last_sent_at).toLocaleString()}</b> ${settings.last_message_id ? `• <a class="btn-outline" style="padding:2px 6px;border-radius:6px" href="https://discord.com/channels/${guildId}/${settings.channel_id || ''}/${settings.last_message_id}" target="_blank">View message</a>` : ''}` : 'Not published yet'}
          </div>

          <div id="preview-embed-card" class="card previewCard hidden">
            <div class="previewTitle">Preview</div>
            <div class="previewDesc">This shows how the embed will appear when a user joins.</div>
            <div id="embed-preview" style="margin-top:12px">
              <div class="discord-msg" style="margin-top:0">
                <div class="dm-header">
                  <div class="dm-avatar">AV</div>
                  <div>
                    <span class="dm-name">${esc(botNickname || 'Forge Hammer')}</span>
                    <span class="dm-badge">BOT</span>
                    <span class="dm-time">Today at 12:53 AM</span>
                  </div>
                </div>
                <div class="discord-embed" id="discord-embed-box" style="margin-top:8px">
                  <img class="e-thumb" id="ep-thumb" alt=""/>
                  <div class="e-thumb-fallback" id="ep-thumb-fallback">No image</div>
                  <div class="e-author" id="ep-author"></div>
                  <div class="e-title" id="ep-title"></div>
                  <div class="e-desc" id="ep-desc"></div>
                  <div class="e-fields" id="ep-fields"></div>
                  <img class="e-image" id="ep-image" alt=""/>
                  <div class="e-image-fallback" id="ep-image-fallback">No image</div>
                  <div class="e-footer" id="ep-footer"></div>
                </div>
              </div>
            </div>
            <div style="margin-top:10px;color:#98a0ab;font-size:13px">
              ${settings.last_sent_at ? `Last published: <b>${new Date(settings.last_sent_at).toLocaleString()}</b>` : 'Not published yet'}
            </div>
          </div>
          
          <!-- For embed_text: show embed under the message content -->
          <div id="preview-combined-embed" class="card previewCard hidden">
            <div class="previewTitle">Preview</div>
            <div class="previewDesc">This shows how the message and embed will appear together.</div>
            <div class="discord-msg" style="margin-top:12px">
              <div class="dm-header">
                <div class="dm-avatar">AV</div>
                <div>
                  <span class="dm-name">${esc(botNickname || 'Forge Hammer')}</span>
                  <span class="dm-badge">BOT</span>
                  <span class="dm-time">Today at 12:53 AM</span>
                </div>
              </div>
              <div class="dm-content" id="live-preview-alt">${esc(settings.message_text || 'Message Content')}</div>
              <div class="discord-embed" id="discord-embed-box-2" style="margin-top:8px">
                <img class="e-thumb" id="ep-thumb-2" alt=""/>
                <div class="e-thumb-fallback" id="ep-thumb-fallback-2">No image</div>
                <div class="e-author" id="ep-author-2"></div>
                <div class="e-title" id="ep-title-2"></div>
                <div class="e-desc" id="ep-desc-2"></div>
                <div class="e-fields" id="ep-fields-2"></div>
                <img class="e-image" id="ep-image-2" alt=""/>
                <div class="e-image-fallback" id="ep-image-fallback-2">No image</div>
                <div class="e-footer" id="ep-footer-2"></div>
              </div>
            </div>
          </div>

          
            <div class="card" style="margin-top:12px">
              <label>Variables</label>
              <div class="vars">
                Use these variables in messages: <br/>
                <div><b>{user}</b> - mention the user</div>
                <div><b>{username}</b> - user's name</div>
                <div><b>{server}</b> - server name</div>
                <div><b>{channel}</b> - channel name</div>
              </div>
            </div>
        </div>
      </div>
    </div>
  `;

  return layout(title + ' — Welcome', body, { guildId });
}

