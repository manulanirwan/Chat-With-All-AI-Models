const DEFAULT_MODEL = "openai/gpt-6-astra";
const STORAGE_KEY = "gpt6-astra-state-v1";
const emptyState = { chats: [], activeId: null, settings: { theme: "dark", model: DEFAULT_MODEL, verbosity: "medium", reasoning: "medium" } };
let state = loadState();
let attachedFile = null;
let generating = false;
let stopRequested = false;
let recognition = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const els = {
  sidebar: $("#sidebar"), backdrop: $("#backdrop"), history: $("#history-list"), historyEmpty: $("#history-empty"),
  scroll: $("#scroll"), welcome: $("#welcome"), messages: $("#messages"), title: $("#chat-title"),
  input: $("#input"), send: $("#send"), attachment: $("#attachment"), file: $("#file"), search: $("#search"),
  modelLabel: $("#model-label"), modalBg: $("#modal-bg"), settings: $("#settings"), modelModal: $("#model-modal"),
  theme: $("#theme"), model: $("#model"), verbosity: $("#verbosity"), reasoning: $("#reasoning"), toasts: $("#toasts")
};

function loadState(){
  try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return parsed ? {...emptyState, ...parsed, settings:{...emptyState.settings,...(parsed.settings||{})}} : structuredClone(emptyState); }
  catch { return structuredClone(emptyState); }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function uid(){ return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function activeChat(){ return state.chats.find(c => c.id === state.activeId) || null; }
function newChatObject(){ return { id: uid(), title: "New conversation", createdAt: Date.now(), updatedAt: Date.now(), messages: [] }; }

function ensureChat(){
  let chat = activeChat();
  if(!chat){ chat = newChatObject(); state.chats.unshift(chat); state.activeId = chat.id; saveState(); }
  return chat;
}
function makeTitle(text){
  const clean = text.replace(/\s+/g," ").trim();
  return clean.length > 42 ? clean.slice(0,42).trim()+"…" : (clean || "New conversation");
}
function toast(message, type=""){
  const t = document.createElement("div"); t.className = `toast ${type}`; t.textContent = message; els.toasts.appendChild(t);
  setTimeout(()=>t.remove(),3200);
}
function escapeHtml(text){
  return String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function renderMarkdown(text){
  let src = escapeHtml(text).replace(/\r/g, "");
  const blocks = [];
  src = src.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const id = `code-${uid()}`; blocks.push({id, code: code.replace(/\n$/g, ""), lang: lang || "code"});
    return `@@CODE_${blocks.length-1}@@`;
  });
  src = src.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');
  src = src.replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>");
  src = src.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/__(.+?)__/g,"<strong>$1</strong>");
  src = src.replace(/\*([^*\n]+)\*/g,"<em>$1</em>");
  src = src.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  src = src.replace(/^\s*[-*] (.+)$/gm,"<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`);
  src = src.replace(/^\s*\d+\. (.+)$/gm,"<li>$1</li>");
  src = src.split(/\n{2,}/).map(part => part.trim()).filter(Boolean).map(part => part.startsWith("<h")||part.startsWith("<ul>")||part.startsWith("@@CODE_") ? part : `<p>${part.replace(/\n/g,"<br>")}</p>`).join("");
  blocks.forEach((b,i)=>{
    const codeHtml = `<div class="code-wrap"><div class="code-head"><span>${escapeHtml(b.lang)}</span><button class="code-copy" data-copy-code="${encodeURIComponent(b.code)}">Copy code</button></div><pre>${escapeHtml(b.code)}</pre></div>`;
    src = src.replace(`@@CODE_${i}@@`, codeHtml);
  });
  return src || "<p> </p>";
}
function formatTime(ts){ return new Date(ts).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"}); }

function renderHistory(){
  const query = els.search.value.trim().toLowerCase();
  els.history.innerHTML = "";
  const chats = state.chats.filter(c => !query || c.title.toLowerCase().includes(query));
  els.historyEmpty.hidden = chats.length > 0;
  chats.forEach(chat=>{
    const row = document.createElement("div"); row.className = `history-item ${chat.id===state.activeId?"active":""}`;
    row.innerHTML = `<span class="hist-icon">◌</span><span class="hist-name"></span><button class="rename" title="Rename chat">⋯</button>`;
    row.querySelector(".hist-name").textContent = chat.title;
    row.addEventListener("click", (e)=>{ if(e.target.closest(".rename")) return; state.activeId=chat.id; saveState(); renderApp(); closeSidebar(); });
    row.querySelector(".rename").addEventListener("click", e=>{e.stopPropagation(); renameChat(chat);});
    els.history.appendChild(row);
  });
}
function renameChat(chat){
  const next = prompt("Rename conversation", chat.title);
  if(next && next.trim()){ chat.title = next.trim().slice(0,80); chat.updatedAt=Date.now(); saveState(); renderApp(); }
}
function renderMessages(){
  const chat = activeChat();
  els.messages.innerHTML = "";
  els.welcome.hidden = !!(chat && chat.messages.length);
  if(!chat) return;
  chat.messages.forEach((m,index)=> appendMessage(m,index, chat.messages));
  requestAnimationFrame(scrollBottom);
}
function appendMessage(m,index,messages){
  const el = document.createElement("article"); el.className = `message ${m.role}`; el.dataset.index=index;
  const isUser = m.role === "user";
  el.innerHTML = `<div class="avatar">${isUser?"YOU":"✦"}</div><div class="message-body"><div class="message-head"><span>${isUser?"You":"GPT-6 Astra"}</span>${m.createdAt?`<span>· ${formatTime(m.createdAt)}</span>`:""}</div><div class="message-text">${isUser?escapeHtml(m.content).replace(/\n/g,"<br>"):renderMarkdown(m.content)}</div><div class="message-actions"></div></div>`;
  const actions = el.querySelector(".message-actions");
  const copy = document.createElement("button"); copy.textContent="Copy"; copy.onclick=()=>navigator.clipboard?.writeText(m.content).then(()=>toast("Copied to clipboard")); actions.appendChild(copy);
  if(isUser){ const edit=document.createElement("button"); edit.textContent="Edit"; edit.onclick=()=>editMessage(index); actions.appendChild(edit); }
  else if(index === messages.length-1 && messages.length>1){ const regen=document.createElement("button"); regen.textContent="Regenerate"; regen.onclick=()=>regenerate(); actions.appendChild(regen); }
  els.messages.appendChild(el);
}
function renderApp(){
  const chat = activeChat();
  els.title.textContent = chat?.title || "New conversation";
  els.modelLabel.textContent = (state.settings.model || DEFAULT_MODEL).split("/").pop();
  renderHistory(); renderMessages(); applyTheme(); syncSettingsControls();
}
function scrollBottom(){ els.scroll.scrollTop = els.scroll.scrollHeight; }

function buildApiMessages(){
  const chat = activeChat();
  const system = {role:"system",content:"You are GPT-6 Astra, a helpful, accurate, practical AI assistant. Use clear structure, explain assumptions, and provide working code when asked. Avoid claiming actions you cannot perform."};
  return [system, ...(chat?.messages||[]).filter(m=>m.role==="user"||m.role==="assistant").map(m=>({role:m.role,content:m.content}))];
}
function apiOptions(){
  const o = {model: state.settings.model || DEFAULT_MODEL, stream:true, normalize:true, verbosity:state.settings.verbosity};
  if(state.settings.reasoning) o.reasoning_effort = state.settings.reasoning;
  return o;
}
function getResponseText(result){
  return result?.message?.content ?? result?.text ?? (typeof result === "string" ? result : "");
}

async function sendMessage(textOverride=null){
  if(generating) return;
  const text = (textOverride ?? els.input.value).trim();
  if(!text && !attachedFile) return;
  const chat = ensureChat();
  const userText = text || "Please analyze the attached image.";
  chat.messages.push({role:"user",content:userText,createdAt:Date.now()});
  if(chat.messages.length === 1) chat.title=makeTitle(userText);
  chat.updatedAt=Date.now(); saveState();
  els.input.value=""; autoSize(); clearAttachment(); renderApp();
  await runGeneration(chat);
}

async function runGeneration(chat){
  generating=true; stopRequested=false; updateSendState();
  const assistant = {role:"assistant",content:"",createdAt:Date.now()}; chat.messages.push(assistant); renderMessages();
  const assistantEl = els.messages.lastElementChild?.querySelector(".message-text");
  if(assistantEl) assistantEl.innerHTML = '<div class="typing"><i></i><i></i><i></i></div>';
  try{
    let result;
    const messages = buildApiMessages();
    const options = apiOptions();
    if(attachedFile){
      result = await puter.ai.chat(messages, attachedFile, false, options);
    }else{
      result = await puter.ai.chat(messages, options);
    }
    if(result && typeof result[Symbol.asyncIterator] === "function"){
      for await(const part of result){
        if(stopRequested) break;
        if(part?.type === "text"){
          assistant.content += part.text || "";
          if(assistantEl) assistantEl.innerHTML = renderMarkdown(assistant.content);
          scrollBottom();
        } else if(part?.type === "error") throw new Error(part.message || "Puter returned an error");
      }
    }else{
      assistant.content = getResponseText(result) || "I couldn't read the model response.";
      if(assistantEl) assistantEl.innerHTML = renderMarkdown(assistant.content);
    }
    if(stopRequested && !assistant.content) assistant.content = "Generation stopped.";
    chat.updatedAt=Date.now(); saveState();
  }catch(err){
    chat.messages.pop();
    const msg = err?.message || String(err) || "Unknown error";
    toast(`AI request failed: ${msg}`, "error");
    if(msg.toLowerCase().includes("model")) toast("Check Settings and confirm that the selected model is available in Puter.", "error");
  }finally{
    generating=false; updateSendState(); renderMessages();
  }
}
function regenerate(){
  if(generating) return;
  const chat=activeChat(); if(!chat || chat.messages.length<2) return;
  const last=chat.messages[chat.messages.length-1]; if(last.role!=="assistant") return;
  chat.messages.pop(); saveState(); renderMessages(); runGeneration(chat);
}
function editMessage(index){
  const chat=activeChat(); const m=chat?.messages[index]; if(!m||m.role!=="user") return;
  chat.messages=chat.messages.slice(0,index); state.activeId=chat.id; saveState(); renderMessages(); els.input.value=m.content; autoSize(); els.input.focus();
}
function updateSendState(){
  els.send.classList.toggle("stop",generating); els.send.innerHTML = generating ? "■" : "↑"; els.send.title = generating ? "Stop response" : "Send";
}
function stopGeneration(){ if(generating){ stopRequested=true; toast("Stopping after the current model chunk…"); } }
function autoSize(){ els.input.style.height="auto"; els.input.style.height=Math.min(els.input.scrollHeight,190)+"px"; }

function clearAttachment(){ attachedFile=null; els.attachment.hidden=true; els.attachment.textContent=""; els.file.value=""; }
function setAttachment(file){
  if(!file) return; if(!file.type.startsWith("image/")){ toast("Please attach an image file.","error"); return; }
  attachedFile=file; els.attachment.hidden=false; els.attachment.innerHTML=`<span>▧ ${escapeHtml(file.name)}</span><button type="button" id="remove-attachment">×</button>`; $("#remove-attachment").onclick=clearAttachment;
}
function applyTheme(){
  document.body.classList.remove("light");
  if(state.settings.theme==="light" || (state.settings.theme==="system" && matchMedia("(prefers-color-scheme: light)").matches)) document.body.classList.add("light");
}
function syncSettingsControls(){
  els.theme.value=state.settings.theme; els.model.value=state.settings.model; els.verbosity.value=state.settings.verbosity; els.reasoning.value=state.settings.reasoning;
}
function openModal(modal){ els.modalBg.hidden=false; modal.hidden=false; setTimeout(()=>modal.querySelector("button,input,select")?.focus(),30); }
function closeModals(){ els.modalBg.hidden=true; [els.settings,els.modelModal].forEach(m=>m.hidden=true); }
function closeSidebar(){ document.body.classList.remove("sidebar-open"); }
function startNewChat(){ const chat=newChatObject(); state.chats.unshift(chat); state.activeId=chat.id; saveState(); els.input.value=""; clearAttachment(); renderApp(); els.input.focus(); closeSidebar(); }
function exportData(){
  const payload=JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2); const blob=new Blob([payload],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`gpt6-astra-chats-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); toast("Chat data exported");
}
function clearData(){
  if(!confirm("Clear every locally saved conversation and setting?")) return;
  localStorage.removeItem(STORAGE_KEY); state=structuredClone(emptyState); ensureChat(); renderApp(); toast("Local data cleared");
}
function handleVoice(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR){toast("Voice input is not supported in this browser.","error");return;}
  if(recognition){ recognition.stop(); recognition=null; return; }
  recognition=new SR(); recognition.lang=navigator.language||"en-US"; recognition.interimResults=true; recognition.continuous=false;
  const base=els.input.value;
  recognition.onresult=(e)=>{ const text=[...e.results].map(r=>r[0].transcript).join(""); els.input.value=(base+(base?" ":"")+text).trim(); autoSize(); };
  recognition.onerror=()=>{toast("Voice input could not start.","error"); recognition=null;};
  recognition.onend=()=>{recognition=null;}; recognition.start(); toast("Listening…");
}

$("#send").onclick=()=>generating?stopGeneration():sendMessage();
els.input.addEventListener("input",autoSize);
els.input.addEventListener("keydown",e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} });
$("#new-chat").onclick=startNewChat;
$("#home").onclick=()=>{if(!activeChat()?.messages.length)renderApp();else startNewChat();};
$("#search").oninput=renderHistory;
$("#file").onchange=e=>setAttachment(e.target.files?.[0]);
$("#voice").onclick=handleVoice;
$("#open-settings").onclick=()=>openModal(els.settings);
$("#top-settings").onclick=()=>openModal(els.settings);
$("#model-picker").onclick=()=>openModal(els.modelModal);
$("#requested-model").onclick=()=>{state.settings.model=DEFAULT_MODEL;saveState();renderApp();closeModals();toast("GPT-6 Astra selected");};
$$(".close-modal").forEach(b=>b.onclick=closeModals); els.modalBg.onclick=closeModals;
$("#save-settings").onclick=()=>{state.settings={theme:els.theme.value,model:els.model.value.trim()||DEFAULT_MODEL,verbosity:els.verbosity.value,reasoning:els.reasoning.value};saveState();renderApp();closeModals();toast("Settings saved");};
$("#export-data").onclick=exportData; $("#clear-data").onclick=clearData;
$("#open-sidebar").onclick=()=>document.body.classList.add("sidebar-open"); $("#close-sidebar").onclick=closeSidebar; els.backdrop.onclick=closeSidebar;
$$(".suggestions button").forEach(b=>b.onclick=()=>sendMessage(b.dataset.prompt));

document.addEventListener("click",e=>{
  const btn=e.target.closest("[data-copy-code]"); if(btn){ const code=decodeURIComponent(btn.dataset.copyCode); navigator.clipboard?.writeText(code).then(()=>{btn.textContent="Copied";setTimeout(()=>btn.textContent="Copy code",1200);}); }
});
document.addEventListener("keydown",e=>{
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.key.toLowerCase()==="k"){e.preventDefault();startNewChat();}
  if(mod&&e.key==="/"){e.preventDefault();els.search.focus();}
  if(e.key==="Escape") {closeModals();closeSidebar();}
});

if(window.matchMedia) matchMedia("(prefers-color-scheme: light)").addEventListener?.("change",applyTheme);
if(!state.chats.length) ensureChat();
renderApp();
