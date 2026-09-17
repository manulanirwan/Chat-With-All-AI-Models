const DEFAULT_MODEL = "openai/gpt-6-astra";
const DEFAULT_MODEL_NAME = "GPT-6 Astra";
const STORAGE_KEY = "gpt6-astra-state-v3";
const LEGACY_KEYS = ["gpt6-astra-state-v2", "gpt6-astra-state-v1"];
const SYSTEM_PROMPT = "You are GPT-6 Astra, a helpful, accurate, practical AI assistant. Use clear structure, explain assumptions, and provide working code when asked. Never claim you performed actions you cannot perform.";
const MAX_HISTORY_MESSAGES = 20;

const MODEL_CHOICES = [
  { name: "GPT-6 Astra", company: "OpenAI", candidates: ["openai/gpt-6-astra"] },
  { name: "GPT-5.6 Cyber", company: "OpenAI", candidates: ["openai/gpt-5.6-cyber"] },
  { name: "Claude Fable 5.1", company: "Anthropic", candidates: ["anthropic/claude-fable-5-1"] },
  { name: "Claude Mythos 5.1", company: "Anthropic", candidates: ["anthropic/claude-mythos-5-1"] },
  { name: "Claude Opus 5", company: "Anthropic", candidates: ["anthropic/claude-opus-5"] },
  { name: "Gemini 3.8 Flash", company: "Google", candidates: ["google/gemini-3.8-flash"] },
  { name: "Gemini 3.8 Flash Cyber", company: "Google", candidates: ["google/gemini-3.8-flash-cyber"] },
  { name: "Grok 4.6", company: "xAI", candidates: ["x-ai/grok-4.6"] },
  { name: "DeepSeek V4.1 Flash", company: "DeepSeek", candidates: ["deepseek/deepseek-v4.1-flash"] },
  { name: "DeepSeek V4 Pro", company: "DeepSeek", candidates: ["deepseek/deepseek-v4-pro"] },
  { name: "Qwen3.8-Max", company: "Alibaba", candidates: ["qwen/qwen3.8-max", "qwen/qwen3.8-max-0902"] },
  { name: "Qwen3.8 Flash-Next", company: "Alibaba", candidates: ["qwen/qwen3.8-flash-next"] },
  { name: "Kimi K3", company: "Moonshot AI", candidates: ["moonshotai/kimi-k3"] },
  { name: "GLM-5.3", company: "Z.ai", candidates: ["z-ai/glm-5.3"] },
  { name: "GLM-5.3 Flash", company: "Z.ai", candidates: ["z-ai/glm-5.3-flash"] },
  { name: "Muse Spark 1.3", company: "Meta", candidates: ["meta/muse-spark-1.3"] },
  { name: "Nemotron 3 Ultra", company: "NVIDIA", candidates: ["nvidia/nemotron-3-ultra"] },
  { name: "Mistral Medium 3.5", company: "Mistral AI", candidates: ["mistralai/mistral-medium-3-5"] },
  { name: "Command A+", company: "Cohere", candidates: ["cohere/command-a-plus"] },
  { name: "Atria Dawn Preview", company: "Atria", candidates: ["atria/atria-dawn-preview"] }
];

const emptyState = {
  chats: [],
  activeId: null,
  settings: {
    theme: "dark",
    model: DEFAULT_MODEL,
    modelName: DEFAULT_MODEL_NAME,
    verbosity: "medium",
    reasoning: "medium"
  }
};

let state = loadState();
let availableModels = [];
let loadingModels = false;
let attachedFile = null;
let generating = false;
let recognition = null;
let modelFilter = "all";
let modelQuery = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  history: $("#history-list"),
  historyEmpty: $("#history-empty"),
  historyCount: $("#history-count"),
  scroll: $("#scroll"),
  welcome: $("#welcome"),
  messages: $("#messages"),
  title: $("#chat-title"),
  titleMeta: $("#title-meta"),
  input: $("#input"),
  send: $("#send"),
  attachment: $("#attachment"),
  file: $("#file"),
  search: $("#search"),
  modelLabel: $("#model-label"),
  sideModelName: $("#side-model-name"),
  sideModelStatus: $("#side-model-status"),
  modalBg: $("#modal-bg"),
  settings: $("#settings"),
  modelModal: $("#model-modal"),
  modelList: $("#model-list"),
  modelSearch: $("#model-search"),
  modelFilters: $("#model-filters"),
  catalogStatus: $("#catalog-status"),
  featuredModels: $("#featured-models"),
  selectedModelCard: $("#selected-model-card"),
  theme: $("#theme"),
  verbosity: $("#verbosity"),
  reasoning: $("#reasoning"),
  toasts: $("#toasts")
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const sources = [STORAGE_KEY, ...LEGACY_KEYS];
    let raw = null;
    for (const key of sources) {
      raw = localStorage.getItem(key);
      if (raw) break;
    }
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

    return {
      ...clone(emptyState),
      ...saved,
      activeId: saved.activeId || null,
      settings: { ...emptyState.settings, ...(saved.settings || {}) },
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
    chat = { id: uid(), title: "New conversation", createdAt: now, updatedAt: now, messages: [] };
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
  window.setTimeout(() => element.remove(), 3600);
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
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function renderHistory() {
  if (!els.history) return;
  const query = String(els.search?.value || "").trim().toLowerCase();
  const chats = state.chats
    .filter((chat) => !query || String(chat.title || "").toLowerCase().includes(query))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  els.history.innerHTML = "";
  if (els.historyEmpty) els.historyEmpty.hidden = chats.length > 0;
  if (els.historyCount) els.historyCount.textContent = String(chats.length);

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
      document.body.classList.remove("sidebar-open");
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

    if (role === "assistant" && index === chat.messages.length - 1 && content) {
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
  const current = getSelectedChoice();
  const displayName = current?.name || state.settings.modelName || modelDisplayName(state.settings.model);
  if (els.title) els.title.textContent = chat?.title || "New conversation";
  if (els.modelLabel) els.modelLabel.textContent = displayName;
  if (els.sideModelName) els.sideModelName.textContent = displayName;
  if (els.sideModelStatus) els.sideModelStatus.textContent = isModelAvailable(current) ? `${current.company} · Ready` : `${current?.company || "AI"} · Not exposed by Puter`;
  if (els.titleMeta) els.titleMeta.textContent = `${MODEL_CHOICES.length} curated models · ${availableModels.length ? `${countAvailableChoices()} available now` : "checking live availability"}`;
  if (els.input) els.input.placeholder = `Message ${displayName}…`;
  renderHistory();
  renderMessages();
  applyTheme();
  syncSettingsControls();
  renderSelectedModelCard();
  renderFeaturedModels();
  updateSendState();
}

function getSelectedChoice() {
  return MODEL_CHOICES.find((choice) => choice.name === state.settings.modelName || choice.candidates.includes(state.settings.model)) || null;
}

function modelDisplayName(modelId) {
  const live = availableModels.find((model) => model.requestId === modelId);
  return live?.name || String(modelId || "").split("/").pop() || DEFAULT_MODEL_NAME;
}

function modelRequestId(model) {
  const id = String(model?.id || "").trim();
  const provider = String(model?.provider || "").trim();
  if (!id) return "";
  if (id.includes("/")) return id;
  return provider ? `${provider}/${id}` : id;
}

function modelSearchText(model) {
  return [model?.id, model?.name, model?.provider, ...(Array.isArray(model?.aliases) ? model.aliases : [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveLiveModel(choice) {
  const candidates = choice?.candidates || [];
  const exactId = availableModels.find((model) => candidates.some((id) => model.requestId.toLowerCase() === id.toLowerCase() || model.id.toLowerCase() === id.toLowerCase()));
  if (exactId) return exactId;

  const targetName = normalizeText(choice?.name);
  if (!targetName) return null;
  return availableModels.find((model) => {
    const names = [model.name, model.id, ...(model.aliases || [])];
    return names.some((name) => normalizeText(name) === targetName);
  }) || null;
}

function isModelAvailable(choice) {
  return Boolean(choice && resolveLiveModel(choice));
}

function countAvailableChoices() {
  return MODEL_CHOICES.filter((choice) => isModelAvailable(choice)).length;
}

function renderFeaturedModels() {
  if (!els.featuredModels) return;
  const picks = [0, 2, 5, 7, 8, 10].map((index) => MODEL_CHOICES[index]).filter(Boolean);
  els.featuredModels.innerHTML = picks.map((choice) => {
    const live = resolveLiveModel(choice);
    const selected = state.settings.modelName === choice.name;
    return `
      <button class="featured-model ${selected ? "selected" : ""} ${live ? "ready" : "unavailable"}" type="button" data-featured-model="${escapeHtml(choice.name)}" ${live ? "" : "disabled"}>
        <span class="provider-logo">${providerInitial(choice.company)}</span>
        <span><b>${escapeHtml(choice.name)}</b><small>${escapeHtml(choice.company)}</small></span>
        <span class="model-state">${live ? "●" : "—"}</span>
      </button>
    `;
  }).join("");

  $$("[data-featured-model]").forEach((button) => {
    button.addEventListener("click", () => selectModelByName(button.getAttribute("data-featured-model")));
  });
}

function providerInitial(company) {
  return String(company || "AI").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "AI";
}

function providerClass(company) {
  return `provider-${String(company || "ai").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function renderModelModal() {
  if (!els.modelList) return;
  const list = getFilteredModelChoices();
  els.modelList.innerHTML = list.length ? list.map((choice, index) => {
    const live = resolveLiveModel(choice);
    const selected = state.settings.modelName === choice.name || state.settings.model === live?.requestId;
    return `
      <button class="model-option ${selected ? "active" : ""} ${live ? "" : "disabled"}" type="button" data-model-index="${index}" ${live ? "" : "disabled"}>
        <span class="provider-logo ${providerClass(choice.company)}">${providerInitial(choice.company)}</span>
        <span class="model-info"><b>${escapeHtml(choice.name)}</b><small>${escapeHtml(choice.company)} · ${escapeHtml(live?.requestId || choice.candidates[0])}</small></span>
        <span class="model-availability ${live ? "ready" : "off"}">${live ? "Ready" : "Unavailable"}</span>
        <span class="check">${selected ? "✓" : ""}</span>
      </button>
    `;
  }).join("") : `<div class="empty-models"><strong>No matching models</strong><span>Try a different search or refresh the live catalog.</span></div>`;

  els.modelList.querySelectorAll("[data-model-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const filtered = getFilteredModelChoices();
      const choice = filtered[Number(button.getAttribute("data-model-index"))];
      if (choice) selectModelByChoice(choice);
    });
  });
}

function getFilteredModelChoices() {
  return MODEL_CHOICES.filter((choice) => {
    const live = resolveLiveModel(choice);
    if (modelFilter === "available" && !live) return false;
    if (!["all", "available"].includes(modelFilter) && modelFilter !== "Other" && choice.company !== modelFilter) return false;
    if (modelFilter === "Other" && ["OpenAI", "Anthropic", "Google"].includes(choice.company)) return false;
    if (modelQuery) {
      const haystack = `${choice.name} ${choice.company} ${choice.candidates.join(" ")}`.toLowerCase();
      if (!haystack.includes(modelQuery)) return false;
    }
    return true;
  });
}

function selectModelByName(name) {
  const choice = MODEL_CHOICES.find((item) => item.name === name);
  if (choice) selectModelByChoice(choice);
}

function selectModelByChoice(choice) {
  const live = resolveLiveModel(choice);
  if (!live) {
    toast(`${choice.name} is not currently exposed by Puter.`, "error");
    return;
  }
  state.settings.model = live.requestId;
  state.settings.modelName = choice.name;
  saveState();
  closeAllModals();
  renderApp();
  toast(`${choice.name} selected`);
}

function renderSelectedModelCard() {
  if (!els.selectedModelCard) return;
  const choice = getSelectedChoice();
  const live = resolveLiveModel(choice);
  els.selectedModelCard.innerHTML = `
    <span class="provider-logo">${providerInitial(choice?.company || "AI")}</span>
    <div><small>SELECTED MODEL</small><b>${escapeHtml(choice?.name || state.settings.modelName || DEFAULT_MODEL_NAME)}</b><span>${escapeHtml(choice?.company || "AI")} · ${escapeHtml(live?.requestId || state.settings.model)}</span></div>
    <button type="button" id="settings-model-switch">Change</button>
  `;
  $("#settings-model-switch")?.addEventListener("click", () => {
    closeAllModals();
    openModelPicker();
  });
}

function updateCatalogStatus() {
  const available = countAvailableChoices();
  if (els.catalogStatus) els.catalogStatus.textContent = loadingModels ? "Refreshing Puter model catalog…" : `${available}/${MODEL_CHOICES.length} selected models currently exposed by Puter`;
  if (els.sideModelStatus) {
    const choice = getSelectedChoice();
    els.sideModelStatus.textContent = isModelAvailable(choice) ? `${choice.company} · Ready` : `${choice?.company || "AI"} · Not exposed by Puter`;
  }
}

async function loadModels(force = false) {
  if (loadingModels && !force) return;
  if (!force && availableModels.length) return;
  if (!window.puter?.ai || typeof window.puter.ai.listModels !== "function") {
    availableModels = [];
    updateCatalogStatus();
    renderApp();
    return;
  }

  loadingModels = true;
  updateCatalogStatus();
  try {
    const rawModels = await window.puter.ai.listModels();
    const models = Array.isArray(rawModels) ? rawModels : [];
    const unique = new Map();
    for (const model of models) {
      const normalized = {
        raw: model,
        id: String(model?.id || "").trim(),
        requestId: modelRequestId(model),
        name: String(model?.name || model?.id || "AI model").trim(),
        provider: String(model?.provider || "").trim(),
        aliases: Array.isArray(model?.aliases) ? model.aliases : [],
        context: Number(model?.context) || 0
      };
      if (normalized.requestId) unique.set(normalized.requestId.toLowerCase(), normalized);
    }
    availableModels = [...unique.values()];

    let selected = getSelectedChoice();
    let liveSelected = resolveLiveModel(selected);
    if (!liveSelected) {
      const defaultChoice = MODEL_CHOICES[0];
      const liveDefault = resolveLiveModel(defaultChoice);
      if (liveDefault) {
        state.settings.model = liveDefault.requestId;
        state.settings.modelName = defaultChoice.name;
        selected = defaultChoice;
        liveSelected = liveDefault;
        saveState();
      }
    }
    if (selected && liveSelected) {
      state.settings.model = liveSelected.requestId;
      state.settings.modelName = selected.name;
      saveState();
    }
  } catch (error) {
    console.warn("Could not load Puter model catalog:", error);
    availableModels = [];
    toast("Could not refresh the live model catalog.", "error");
  } finally {
    loadingModels = false;
    updateCatalogStatus();
    renderApp();
    if (els.modelModal && !els.modelModal.hidden) renderModelModal();
  }
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

function supportsReasoning() {
  return ["GPT-6 Astra", "Claude Fable 5.1", "Claude Mythos 5.1", "Claude Opus 5", "Grok 4.6", "DeepSeek V4.1 Flash", "DeepSeek V4 Pro", "Qwen3.8-Max", "Kimi K3", "GLM-5.3", "GLM-5.3 Flash", "Nemotron 3 Ultra", "Mistral Medium 3.5"].includes(state.settings.modelName);
}

function apiOptions() {
  const options = {
    model: state.settings.model,
    normalize: true
  };
  if (["low", "medium", "high"].includes(state.settings.verbosity)) options.verbosity = state.settings.verbosity;
  if (supportsReasoning() && ["minimal", "low", "medium", "high", "xhigh"].includes(state.settings.reasoning)) options.reasoning_effort = state.settings.reasoning;
  return options;
}

function extractResponseText(response) {
  const content = response?.message?.content ?? response?.text;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      return "";
    }).filter(Boolean).join("\n").trim();
  }
  return typeof response === "string" ? response.trim() : "";
}

function friendlyAiError(error) {
  const raw = String(error?.message || error || "Unknown error");
  const lower = raw.toLowerCase();
  if (lower.includes("credit") || lower.includes("quota") || lower.includes("usage") || lower.includes("limit")) return "Puter AI usage limit reached. Try again after the limit resets.";
  if (lower.includes("model") && (lower.includes("not found") || lower.includes("unsupported") || lower.includes("invalid"))) return "That model is no longer available through Puter. Open Model Switcher and choose a Ready model.";
  if (lower.includes("content") && lower.includes("property")) return "The selected model rejected this request format. Choose another Ready model and try again.";
  return raw;
}

async function requestCompletion(prompt, file = null) {
  if (!window.puter?.ai || typeof window.puter.ai.chat !== "function") throw new Error("Puter.js is not ready. Refresh the page and try again.");
  const choice = getSelectedChoice();
  const live = resolveLiveModel(choice);
  if (!live) throw new Error("The selected model is not currently available through Puter.");

  const options = apiOptions();
  const response = file
    ? await window.puter.ai.chat(prompt, file, false, options)
    : await window.puter.ai.chat(prompt, options);
  const text = extractResponseText(response);
  if (!text) throw new Error("The model returned an empty response.");
  return text;
}

async function sendMessage(textOverride = null) {
  if (generating) return;
  const raw = textOverride ?? els.input?.value ?? "";
  const text = String(raw).trim();
  if (!text && !attachedFile) return;

  const choice = getSelectedChoice();
  if (!isModelAvailable(choice)) {
    await loadModels(true);
    if (!isModelAvailable(choice)) {
      toast(`${choice?.name || state.settings.modelName} is not currently available through Puter.`, "error");
      return;
    }
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
    assistant.content = await requestCompletion(buildPrompt(chat), file);
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
  if (chat.messages.at(-1)?.role !== "assistant") return;
  chat.messages.pop();
  saveState();
  await runWithExistingChat(chat);
}

async function runWithExistingChat(chat) {
  if (generating || !chat) return;
  const choice = getSelectedChoice();
  if (!isModelAvailable(choice)) {
    toast(`${choice?.name || state.settings.modelName} is not currently available through Puter.`, "error");
    return;
  }
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
  chat.messages = chat.messages.slice(0, index);
  saveState();
  renderMessages();
  if (els.input) {
    els.input.value = message.content || "";
    autoSize();
    els.input.focus();
  }
}

function updateSendState() {
  if (!els.send) return;
  els.send.disabled = generating;
  els.send.classList.toggle("stop", generating);
  els.send.innerHTML = generating ? "■" : "↑";
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

function resetModelFilters() {
  modelFilter = "all";
  modelQuery = "";
  if (els.modelSearch) els.modelSearch.value = "";
  $$("#model-filters button").forEach((button) => button.classList.toggle("active", button.dataset.filter === "all"));
}

async function openModelPicker() {
  openModal(els.modelModal);
  renderModelModal();
  if (!availableModels.length) await loadModels();
  renderModelModal();
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
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
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
  $("#side-model-picker")?.addEventListener("click", openModelPicker);
  $("#top-settings")?.addEventListener("click", () => openModal(els.settings));
  $("#open-settings")?.addEventListener("click", () => openModal(els.settings));
  $("#refresh-models")?.addEventListener("click", () => loadModels(true));
  $("#refresh-models-modal")?.addEventListener("click", () => loadModels(true));
  els.modalBg?.addEventListener("click", closeAllModals);
  $$(".close-modal").forEach((button) => button.addEventListener("click", closeAllModals));
  els.modelSearch?.addEventListener("input", (event) => {
    modelQuery = String(event.target.value || "").trim().toLowerCase();
    renderModelModal();
  });
  els.modelFilters?.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      modelFilter = button.dataset.filter || "all";
      els.modelFilters.querySelectorAll("button").forEach((item) => item.classList.toggle("active", item === button));
      renderModelModal();
    });
  });
  $("#save-settings")?.addEventListener("click", () => {
    state.settings.theme = els.theme?.value || "dark";
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
  resetModelFilters();
  bindEvents();
  ensureChat();
  renderApp();
  autoSize();
  await loadModels();
  updateCatalogStatus();
  renderApp();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
