const DEFAULT_MODEL = "openai/gpt-6-astra";
const STORAGE_KEY = "gpt6-astra-state-v2";
const SYSTEM_PROMPT = "You are GPT-6 Astra, a helpful, accurate, practical AI assistant. Use clear structure, explain assumptions, and provide working code when asked. Never claim you performed actions you cannot perform.";
const MAX_HISTORY_MESSAGES = 20;
const MAX_FEATURED_MODELS = 20;

const emptyState = {
  chats: [],
  activeId: null,
  settings: {
    theme: "dark",
    model: DEFAULT_MODEL,
    modelName: "GPT-6 Astra",
    verbosity: "medium",
    reasoning: "medium"
  }
};

let state = loadState();
let attachedFile = null;
let generating = false;
let recognition = null;
let availableModels = [];
let modelLoadPromise = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  history: $("#history-list"),
  historyEmpty: $("#history-empty"),
  scroll: $("#scroll"),
  welcome: $("#welcome"),
  messages: $("#messages"),
  title: $("#chat-title"),
  input: $("#input"),
  send: $("#send"),
  attachment: $("#attachment"),
  file: $("#file"),
  search: $("#search"),
  modelLabel: $("#model-label"),
  modalBg: $("#modal-bg"),
  settings: $("#settings"),
  modelModal: $("#model-modal"),
  theme: $("#theme"),
  model: $("#model"),
  verbosity: $("#verbosity"),
  reasoning: $("#reasoning"),
  toasts: $("#toasts")
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("gpt6-astra-state-v1");
    if (!raw) return clone(emptyState);

    const saved = JSON.parse(raw) || {};
    const chats = Array.isArray(saved.chats)
      ? saved.chats.map((chat) => ({
          id: String(chat?.id || uid()),
          title: String(chat?.title || "New conversation"),
          createdAt: Number(chat?.createdAt) || Date.now(),
          updatedAt: Number(chat?.updatedAt) || Date.now(),
          messages: Array.isArray(chat?.messages)
            ? chat.messages
                .filter((message) => message && (message.role === "user" || message.role === "assistant"))
                .map((message) => ({
                  role: message.role,
                  content: typeof message.content === "string" ? message.content : "",
                  createdAt: Number(message.createdAt) || Date.now()
                }))
            : []
        }))
      : [];

    const settings = {
      ...emptyState.settings,
      ...(saved.settings || {})
    };

    return {
      ...clone(emptyState),
      ...saved,
      activeId: saved.activeId || null,
      settings,
      chats
    };
  } catch {
    return clone(emptyState);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save local chat state:", error);
  }
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function activeChat() {
  return state.chats.find((chat) => chat.id === state.activeId) || null;
}

function ensureChat() {
  let chat = activeChat();
  if (!chat) {
    const now = Date.now();
    chat = {
      id: uid(),
      title: "New conversation",
      createdAt: now,
      updatedAt: now,
      messages: []
    };
    state.chats.unshift(chat);
    state.activeId = chat.id;
    saveState();
  }
  return chat;
}

function makeTitle(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42).trim()}…` : clean || "New conversation";
}

function toast(message, type = "") {
  if (!els.toasts) return;
  const element = document.createElement("div");
  element.className = `toast ${type}`.trim();
  element.textContent = message;
  els.toasts.appendChild(element);
  window.setTimeout(() => element.remove(), 3500);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderText(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function formatTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function renderHistory() {
  if (!els.history) return;
  const query = String(els.search?.value || "").trim().toLowerCase();
  els.history.innerHTML = "";

  const chats = state.chats
    .filter((chat) => !query || String(chat.title || "").toLowerCase().includes(query))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  if (els.historyEmpty) els.historyEmpty.hidden = chats.length > 0;

  for (const chat of chats) {
    const row = document.createElement("div");
    row.className = `history-item ${chat.id === state.activeId ? "active" : ""}`;
    row.innerHTML = `
      <span class="hist-icon">◌</span>
      <span class="hist-name"></span>
      <button class="rename" type="button" title="Rename chat" aria-label="Rename chat">⋯</button>
    `;
    row.querySelector(".hist-name").textContent = chat.title || "New conversation";
    row.addEventListener("click", (event) => {
      if (event.target.closest(".rename")) return;
      state.activeId = chat.id;
      saveState();
      closeAllModals();
      renderApp();
    });
    row.querySelector(".rename").addEventListener("click", (event) => {
      event.stopPropagation();
      const next = window.prompt("Rename conversation", chat.title || "New conversation");
      if (next && next.trim()) {
        chat.title = next.trim().slice(0, 80);
        chat.updatedAt = Date.now();
        saveState();
        renderApp();
      }
    });
    els.history.appendChild(row);
  }
}

function renderMessages() {
  const chat = activeChat();
  if (!els.messages) return;

  els.messages.innerHTML = "";
  if (els.welcome) els.welcome.hidden = Boolean(chat?.messages?.length);
  if (!chat) return;

  for (const [index, message] of chat.messages.entries()) {
    const role = message?.role === "user" ? "user" : "assistant";
    const content = typeof message?.content === "string" ? message.content : "";
    const article = document.createElement("article");
    article.className = `message ${role}`;
    article.innerHTML = `
      <div class="avatar">${role === "user" ? "YOU" : "✦"}</div>
      <div class="message-body">
        <div class="message-head">
          <span>${role === "user" ? "You" : escapeHtml(state.settings.modelName || "AI")}</span>
          ${message?.createdAt ? `<span>· ${formatTime(message.createdAt)}</span>` : ""}
        </div>
        <div class="message-text">${renderText(content)}</div>
        <div class="message-actions"></div>
      </div>
    `;

    const actions = article.querySelector(".message-actions");
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        toast("Copied to clipboard");
      } catch {
        toast("Could not copy text", "error");
      }
    });
    actions.appendChild(copy);

    if (role === "user") {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => editMessage(index));
      actions.appendChild(edit);
    }

    if (role === "assistant" && index === chat.messages.length - 1 && chat.messages.length > 1 && content) {
      const regenerate = document.createElement("button");
      regenerate.type = "button";
      regenerate.textContent = "Regenerate";
      regenerate.addEventListener("click", regenerateLast);
      actions.appendChild(regenerate);
    }

    els.messages.appendChild(article);
  }

  requestAnimationFrame(() => {
    if (els.scroll) els.scroll.scrollTop = els.scroll.scrollHeight;
  });
}

function renderApp() {
  const chat = activeChat();
  if (els.title) els.title.textContent = chat?.title || "New conversation";
  if (els.modelLabel) {
    els.modelLabel.textContent = state.settings.modelName || modelDisplayName(state.settings.model) || "Select model";
  }
  renderHistory();
  renderMessages();
  applyTheme();
  syncSettingsControls();
  updateSendState();
}

function buildPrompt(chat) {
  const history = (chat?.messages || [])
    .filter((message) =>
      (message?.role === "user" || message?.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content.trim()}`)
    .join("\n\n");

  return `${SYSTEM_PROMPT}\n\n${history}`.trim();
}

function apiOptions() {
  const options = {
    model: state.settings.model || DEFAULT_MODEL,
    normalize: true
  };

  if (["low", "medium", "high"].includes(state.settings.verbosity)) {
    options.verbosity = state.settings.verbosity;
  }

  if (["none", "minimal", "low", "medium", "high", "xhigh"].includes(state.settings.reasoning)) {
    options.reasoning_effort = state.settings.reasoning;
  }

  return options;
}

function extractResponseText(response) {
  const content = response?.message?.content ?? response?.text;
  if (typeof content === "string") return content.trim();

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return typeof response === "string" ? response.trim() : "";
}

function friendlyAiError(error) {
  const raw = String(error?.message || error || "Unknown error");
  const lower = raw.toLowerCase();

  if (lower.includes("credit") || lower.includes("quota") || lower.includes("limit")) {
    return "Puter AI credits or usage limit reached. Try again after the limit resets, or switch to another available model.";
  }

  if (lower.includes("model") && (lower.includes("not found") || lower.includes("unsupported") || lower.includes("invalid"))) {
    return "That model is not currently available through Puter. Open the model picker and choose an available model.";
  }

  if (lower.includes("content") && lower.includes("property")) {
    return "The selected model request format was rejected. Please switch to another available model and try again.";
  }

  return raw;
}

async function requestCompletion(prompt, file = null) {
  const puterApi = window.puter?.ai;
  if (!puterApi || typeof puterApi.chat !== "function") {
    throw new Error("Puter.js is not ready. Please refresh the page and try again.");
  }

  const options = apiOptions();
  const response = file
    ? await puterApi.chat(prompt, file, false, options)
    : await puterApi.chat(prompt, options);

  const text = extractResponseText(response);
  if (!text) {
    throw new Error("The model returned an empty response.");
  }
  return text;
}

async function sendMessage(textOverride = null) {
  if (generating) return;

  const raw = textOverride ?? els.input?.value ?? "";
  const text = String(raw).trim();
  if (!text && !attachedFile) return;

  if (!window.puter?.ai || typeof window.puter.ai.chat !== "function") {
    toast("Puter.js is not ready. Please refresh the page and try again.", "error");
    return;
  }

  const chat = ensureChat();
  const file = attachedFile;
  const userText = text || "Please analyze the attached image.";

  chat.messages.push({ role: "user", content: userText, createdAt: Date.now() });
  if (chat.messages.length === 1) chat.title = makeTitle(userText);
  chat.updatedAt = Date.now();
  saveState();

  if (els.input) els.input.value = "";
  autoSize();
  clearAttachment();

  const assistant = { role: "assistant", content: "", createdAt: Date.now() };
  chat.messages.push(assistant);
  generating = true;
  updateSendState();
  renderApp();

  try {
    const prompt = buildPrompt(chat);
    assistant.content = await requestCompletion(prompt, file);
    chat.updatedAt = Date.now();
    saveState();
    renderMessages();
  } catch (error) {
    chat.messages.pop();
    saveState();
    renderMessages();
    toast(`AI request failed: ${friendlyAiError(error)}`, "error");
  } finally {
    generating = false;
    updateSendState();
  }
}

async function regenerateLast() {
  if (generating) return;
  const chat = activeChat();
  if (!chat || chat.messages.length < 2) return;

  const last = chat.messages[chat.messages.length - 1];
  if (last?.role !== "assistant") return;

  chat.messages.pop();
  saveState();
  renderMessages();
  await runWithExistingChat(chat);
}

async function runWithExistingChat(chat) {
  if (generating || !chat) return;

  const assistant = { role: "assistant", content: "", createdAt: Date.now() };
  chat.messages.push(assistant);
  generating = true;
  updateSendState();
  renderMessages();

  try {
    assistant.content = await requestCompletion(buildPrompt(chat));
    chat.updatedAt = Date.now();
    saveState();
    renderMessages();
  } catch (error) {
    chat.messages.pop();
    saveState();
    renderMessages();
    toast(`AI request failed: ${friendlyAiError(error)}`, "error");
  } finally {
    generating = false;
    updateSendState();
  }
}

function editMessage(index) {
  const chat = activeChat();
  const message = chat?.messages?.[index];
  if (!chat || message?.role !== "user") return;

  const original = message.content || "";
  chat.messages = chat.messages.slice(0, index);
  saveState();
  renderMessages();

  if (els.input) {
    els.input.value = original;
    autoSize();
    els.input.focus();
  }
}

function updateSendState() {
  if (!els.send) return;
  els.send.disabled = generating;
  els.send.classList.toggle("stop", generating);
  els.send.innerHTML = generating ? "■" : "↑";
  els.send.title = generating ? "Generating" : "Send";
  els.send.setAttribute("aria-busy", generating ? "true" : "false");
}

function autoSize() {
  if (!els.input) return;
  els.input.style.height = "auto";
  els.input.style.height = `${Math.min(els.input.scrollHeight, 190)}px`;
}

function clearAttachment() {
  attachedFile = null;
  if (els.attachment) {
    els.attachment.hidden = true;
    els.attachment.textContent = "";
  }
  if (els.file) els.file.value = "";
}

function setAttachment(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast("Please attach an image file.", "error");
    return;
  }

  attachedFile = file;
  if (els.attachment) {
    els.attachment.hidden = false;
    els.attachment.innerHTML = `<span>▧ ${escapeHtml(file.name)}</span><button type="button" id="remove-attachment" aria-label="Remove attachment">×</button>`;
    els.attachment.querySelector("#remove-attachment")?.addEventListener("click", clearAttachment);
  }
}

function applyTheme() {
  document.body.classList.remove("light");
  const systemLight = state.settings.theme === "system" && window.matchMedia?.("(prefers-color-scheme: light)").matches;
  if (state.settings.theme === "light" || systemLight) document.body.classList.add("light");
}

function syncSettingsControls() {
  if (els.theme) els.theme.value = state.settings.theme;
  if (els.model) els.model.value = state.settings.model;
  if (els.verbosity) els.verbosity.value = state.settings.verbosity;
  if (els.reasoning) els.reasoning.value = state.settings.reasoning;
}

function openModal(modal) {
  if (!modal) return;
  if (els.settings) els.settings.hidden = modal !== els.settings;
  if (els.modelModal) els.modelModal.hidden = modal !== els.modelModal;
  if (els.modalBg) els.modalBg.hidden = false;
  document.body.classList.add("modal-open");
}

function closeAllModals() {
  if (els.settings) els.settings.hidden = true;
  if (els.modelModal) els.modelModal.hidden = true;
  if (els.modalBg) els.modalBg.hidden = true;
  document.body.classList.remove("modal-open");
}

function renderModelModal(models) {
  if (!els.modelModal) return;
  const current = state.settings.model;
  const content = models.length
    ? models.map((model) => {
        const selected = model.requestId === current;
        return `
          <button class="model-option ${selected ? "active" : ""}" type="button" data-model-id="${escapeHtml(model.requestId)}">
            <i></i>
            <span><b>${escapeHtml(model.name)}</b><small>${escapeHtml(model.providerLabel)} · ${escapeHtml(model.id)}</small></span>
            <span aria-hidden="true">${selected ? "✓" : ""}</span>
          </button>
        `;
      }).join("")
    : `<div class="model-help">Could not load the current Puter model catalog. The default GPT-6 Astra model can still be used.</div>`;

  els.modelModal.innerHTML = `
    <div class="modal-head"><div><small>MODEL</small><h2>Choose model</h2></div><button class="icon close-model-modal" type="button" aria-label="Close">×</button></div>
    <div class="model-list" style="max-height:58vh;overflow:auto;display:grid;gap:8px">${content}</div>
    <p class="model-help">Showing up to 20 current, high-profile models exposed by Puter. Availability can change with provider limits.</p>
  `;

  els.modelModal.querySelector(".close-model-modal")?.addEventListener("click", closeAllModals);
  els.modelModal.querySelectorAll("[data-model-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-model-id");
      const selected = models.find((model) => model.requestId === id);
      if (!id || !selected) return;
      state.settings.model = selected.requestId;
      state.settings.modelName = selected.name;
      saveState();
      closeAllModals();
      renderApp();
      toast(`${selected.name} selected`);
    });
  });
}

function modelDisplayName(modelId) {
  const match = availableModels.find((model) => model.requestId === modelId);
  return match?.name || String(modelId || "").split("/").pop() || "Select model";
}

function modelRequestId(model) {
  const id = String(model?.id || "").trim();
  const provider = String(model?.provider || "").trim();
  if (!id) return "";
  if (id.includes("/")) return id;
  if (provider && provider !== "openrouter") return `${provider}/${id}`;
  return id;
}

function modelSearchText(model) {
  return [model?.id, model?.name, ...(Array.isArray(model?.aliases) ? model.aliases : []), model?.provider]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const FEATURE_PATTERNS = [
  /gpt[- ]?6[^a-z0-9]?astra/i,
  /gpt[- ]?5\.6[^a-z0-9]?(sol|terra|luna)/i,
  /claude[^\n]*(fable|mythos|opus ?5|sonnet ?5)/i,
  /gemini[^\n]*3\.8[^\n]*(flash|cyber)/i,
  /grok[^\n]*4\.6/i,
  /deepseek[^\n]*v4\.1/i,
  /qwen[^\n]*3\.8/i,
  /kimi[^\n]*k3/i,
  /glm[^\n]*5\.3/i,
  /mistral[^\n]*(medium ?3\.5)/i,
  /command[^\n]*a\+/i,
  /muse[^\n]*spark/i,
  /nemotron[^\n]*3/i
];

function scoreModel(model) {
  const text = modelSearchText(model);
  const provider = String(model?.provider || "").toLowerCase();
  let score = 0;

  FEATURE_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(text)) score += 1000 - index * 30;
  });

  const providerRank = {
    openai: 90,
    anthropic: 88,
    google: 86,
    xai: 84,
    deepseek: 82,
    alibaba: 80,
    moonshot: 78,
    zai: 76,
    mistral: 74,
    meta: 72,
    nvidia: 70,
    cohere: 68
  };

  score += providerRank[provider] || 20;
  if (model?.context) score += Math.min(Number(model.context) / 100000, 20);
  return score;
}

async function loadModels() {
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = (async () => {
    try {
      if (!window.puter?.ai || typeof window.puter.ai.listModels !== "function") {
        availableModels = [];
        return [];
      }

      const rawModels = await window.puter.ai.listModels();
      const candidates = Array.isArray(rawModels) ? rawModels : [];
      const normalized = candidates
        .map((model) => ({
          raw: model,
          id: String(model?.id || "").trim(),
          requestId: modelRequestId(model),
          providerLabel: String(model?.provider || "Puter").trim() || "Puter",
          name: String(model?.name || model?.id || "AI model").trim(),
          aliases: Array.isArray(model?.aliases) ? model.aliases : [],
          context: Number(model?.context) || 0
        }))
        .filter((model) => model.id && model.requestId);

      const unique = new Map();
      for (const model of normalized) {
        const key = model.requestId.toLowerCase();
        if (!unique.has(key)) unique.set(key, model);
      }

      const sorted = [...unique.values()].sort((a, b) => scoreModel(b.raw) - scoreModel(a.raw));
      const featured = sorted.filter((model) => FEATURE_PATTERNS.some((pattern) => pattern.test(modelSearchText(model.raw))));
      const remainder = sorted.filter((model) => !featured.includes(model));
      availableModels = [...featured, ...remainder].slice(0, MAX_FEATURED_MODELS);

      const defaultMatch = availableModels.find((model) =>
        model.requestId === DEFAULT_MODEL || model.id === "gpt-6-astra" || /gpt[- ]?6[^a-z0-9]?astra/i.test(model.name)
      );
      if (!state.settings.model && defaultMatch) {
        state.settings.model = defaultMatch.requestId;
        state.settings.modelName = defaultMatch.name;
      }

      return availableModels;
    } catch (error) {
      console.warn("Could not load Puter model catalog:", error);
      availableModels = [];
      return [];
    }
  })();

  return modelLoadPromise;
}

async function openModelPicker() {
  openModal(els.modelModal);
  renderModelModal(availableModels);
  if (!availableModels.length) {
    await loadModels();
    renderModelModal(availableModels);
  }
}

function newChat() {
  closeAllModals();
  state.activeId = null;
  ensureChat();
  if (els.input) {
    els.input.value = "";
    els.input.focus();
  }
  clearAttachment();
  renderApp();
}

function exportChats() {
  try {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gpt-6-astra-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("Chats exported");
  } catch {
    toast("Could not export chats", "error");
  }
}

function clearData() {
  const confirmed = window.confirm("Clear all locally saved chats and settings?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("gpt6-astra-state-v1");
  state = clone(emptyState);
  attachedFile = null;
  ensureChat();
  saveState();
  renderApp();
  toast("Local data cleared");
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast("Voice input is not supported in this browser.", "error");
    return;
  }

  if (recognition) {
    recognition.stop();
    recognition = null;
    toast("Voice input stopped");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  let finalText = "";
  recognition.onresult = (event) => {
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (els.input) {
      const base = els.input.value.replace(/\s+$/, "");
      els.input.value = `${base}${base ? " " : ""}${finalText}${interim}`.trimStart();
      autoSize();
    }
  };
  recognition.onerror = () => toast("Voice input could not be started.", "error");
  recognition.onend = () => { recognition = null; };
  recognition.start();
  toast("Listening…");
}

function bindEvents() {
  els.send?.addEventListener("click", () => sendMessage());
  els.input?.addEventListener("input", autoSize);
  els.input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  els.file?.addEventListener("change", (event) => setAttachment(event.target.files?.[0] || null));
  els.search?.addEventListener("input", renderHistory);
  $("#new-chat")?.addEventListener("click", newChat);
  $("#home")?.addEventListener("click", newChat);
  $("#voice")?.addEventListener("click", startVoiceInput);
  $("#export-data")?.addEventListener("click", exportChats);
  $("#clear-data")?.addEventListener("click", clearData);
  $("#model-picker")?.addEventListener("click", openModelPicker);
  $("#top-settings")?.addEventListener("click", () => openModal(els.settings));
  $("#open-settings")?.addEventListener("click", () => openModal(els.settings));
  els.modalBg?.addEventListener("click", closeAllModals);

  $$(".close-modal").forEach((button) => button.addEventListener("click", closeAllModals));
  $("#save-settings")?.addEventListener("click", () => {
    state.settings.theme = els.theme?.value || "dark";
    state.settings.model = els.model?.value?.trim() || DEFAULT_MODEL;
    state.settings.modelName = modelDisplayName(state.settings.model);
    state.settings.verbosity = els.verbosity?.value || "medium";
    state.settings.reasoning = els.reasoning?.value || "medium";
    saveState();
    closeAllModals();
    renderApp();
    toast("Settings saved");
  });

  $$("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const prompt = button.getAttribute("data-prompt") || "";
      if (els.input) els.input.value = prompt;
      autoSize();
      els.input?.focus();
    });
  });

  $("#open-sidebar")?.addEventListener("click", () => document.body.classList.add("sidebar-open"));
  $("#close-sidebar")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  $("#backdrop")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
      document.body.classList.remove("sidebar-open");
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      newChat();
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "/") {
      event.preventDefault();
      els.search?.focus();
    }
  });

  window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", applyTheme);
}

async function init() {
  bindEvents();
  ensureChat();
  renderApp();
  autoSize();

  await loadModels();
  if (availableModels.length) {
    const exact = availableModels.find((model) => model.requestId === state.settings.model);
    if (exact) {
      state.settings.modelName = exact.name;
      saveState();
      renderApp();
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
