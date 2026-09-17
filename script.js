const DEFAULT_MODEL = "openai/gpt-6-astra";
const STORAGE_KEY = "gpt6-astra-state-v1";
const SYSTEM_PROMPT = "You are GPT-6 Astra, a helpful, accurate, practical AI assistant. Use clear structure, explain assumptions, and provide working code when asked. Avoid claiming actions you cannot perform.";

const emptyState = {
  chats: [],
  activeId: null,
  settings: {
    theme: "dark",
    model: DEFAULT_MODEL,
    verbosity: "medium",
    reasoning: "medium"
  }
};

let state = loadState();
let attachedFile = null;
let generating = false;
let recognition = null;

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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(emptyState);

    const saved = JSON.parse(raw);
    return {
      ...structuredClone(emptyState),
      ...saved,
      settings: {
        ...emptyState.settings,
        ...(saved?.settings || {})
      },
      chats: Array.isArray(saved?.chats)
        ? saved.chats.map((chat) => ({
            ...chat,
            messages: Array.isArray(chat?.messages) ? chat.messages : []
          }))
        : []
    };
  } catch {
    return structuredClone(emptyState);
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
  setTimeout(() => element.remove(), 3500);
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

  const chats = state.chats.filter((chat) =>
    !query || String(chat.title || "").toLowerCase().includes(query)
  );

  if (els.historyEmpty) els.historyEmpty.hidden = chats.length > 0;

  for (const chat of chats) {
    const row = document.createElement("div");
    row.className = `history-item ${chat.id === state.activeId ? "active" : ""}`;
    row.innerHTML = `
      <span class="hist-icon">◌</span>
      <span class="hist-name"></span>
      <button class="rename" type="button" title="Rename chat">⋯</button>
    `;
    row.querySelector(".hist-name").textContent = chat.title || "New conversation";
    row.addEventListener("click", (event) => {
      if (event.target.closest(".rename")) return;
      state.activeId = chat.id;
      saveState();
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
    const article = document.createElement("article");
    const role = message?.role === "user" ? "user" : "assistant";
    const content = typeof message?.content === "string" ? message.content : "";

    article.className = `message ${role}`;
    article.innerHTML = `
      <div class="avatar">${role === "user" ? "YOU" : "✦"}</div>
      <div class="message-body">
        <div class="message-head">
          <span>${role === "user" ? "You" : "GPT-6 Astra"}</span>
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

    if (role === "assistant" && index === chat.messages.length - 1 && chat.messages.length > 1) {
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
    els.modelLabel.textContent = (state.settings.model || DEFAULT_MODEL).split("/").pop();
  }
  renderHistory();
  renderMessages();
  applyTheme();
  syncSettingsControls();
}

function buildPrompt(chat) {
  const history = (chat?.messages || [])
    .filter((message) =>
      (message?.role === "user" || message?.role === "assistant") &&
      typeof message?.content === "string" &&
      message.content.trim().length > 0
    )
    .slice(-20)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content.trim()}`)
    .join("\n\n");

  return `${SYSTEM_PROMPT}\n\n${history}`;
}

function apiOptions() {
  const options = {
    model: state.settings.model || DEFAULT_MODEL
  };

  if (["low", "medium", "high"].includes(state.settings.verbosity)) {
    options.verbosity = state.settings.verbosity;
  }

  if (["none", "minimal", "low", "medium", "high", "xhigh"].includes(state.settings.reasoning)) {
    options.reasoning_effort = state.settings.reasoning;
  }

  return options;
}

function getResponseText(response) {
  const content = response?.message?.content ?? response?.text ?? response;
  return typeof content === "string" ? content : "";
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

  chat.messages.push({
    role: "user",
    content: userText,
    createdAt: Date.now()
  });

  if (chat.messages.length === 1) chat.title = makeTitle(userText);
  chat.updatedAt = Date.now();
  saveState();

  if (els.input) els.input.value = "";
  autoSize();
  clearAttachment();
  renderApp();

  generating = true;
  updateSendState();

  const assistant = {
    role: "assistant",
    content: "",
    createdAt: Date.now()
  };
  chat.messages.push(assistant);
  renderMessages();

  try {
    const prompt = buildPrompt(chat);
    const options = apiOptions();

    let response;
    if (file) {
      response = await window.puter.ai.chat(prompt, file, false, options);
    } else {
      response = await window.puter.ai.chat(prompt, options);
    }

    assistant.content = getResponseText(response) || "I couldn't read the model response.";
    chat.updatedAt = Date.now();
    saveState();
    renderMessages();
  } catch (error) {
    chat.messages.pop();
    saveState();
    renderMessages();
    toast(`AI request failed: ${error?.message || String(error)}`, "error");
  } finally {
    generating = false;
    updateSendState();
  }
}

function regenerateLast() {
  if (generating) return;
  const chat = activeChat();
  if (!chat || chat.messages.length < 2) return;

  const last = chat.messages[chat.messages.length - 1];
  if (last?.role !== "assistant") return;

  chat.messages.pop();
  saveState();

  const lastUser = [...chat.messages].reverse().find((message) => message.role === "user");
  if (!lastUser) return;

  runWithExistingChat(chat, lastUser.content);
}

async function runWithExistingChat(chat, userText) {
  if (generating) return;
  if (!window.puter?.ai || typeof window.puter.ai.chat !== "function") {
    toast("Puter.js is not ready. Please refresh the page and try again.", "error");
    return;
  }

  const assistant = {
    role: "assistant",
    content: "",
    createdAt: Date.now()
  };
  chat.messages.push(assistant);
  renderMessages();

  generating = true;
  updateSendState();

  try {
    const prompt = buildPrompt(chat);
    const response = await window.puter.ai.chat(prompt, apiOptions());
    assistant.content = getResponseText(response) || "I couldn't read the model response.";
    chat.updatedAt = Date.now();
    saveState();
    renderMessages();
  } catch (error) {
    chat.messages.pop();
    saveState();
    renderMessages();
    toast(`AI request failed: ${error?.message || String(error)}`, "error");
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
  els.send.title = generating ? "Generating" : "Send";
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
    els.attachment.innerHTML = `<span>▧ ${escapeHtml(file.name)}</span><button type="button" id="remove-attachment">×</button>`;
    els.attachment.querySelector("#remove-attachment")?.addEventListener("click", clearAttachment);
  }
}

function applyTheme() {
  document.body.classList.remove("light");
  if (
    state.settings.theme === "light" ||
    (state.settings.theme === "system" && window.matchMedia?.("(prefers-color-scheme: light)").matches)
  ) {
    document.body.classList.add("light");
  }
}

function syncSettingsControls() {
  if (els.theme) els.theme.value = state.settings.theme;
  if (els.model) els.model.value = state.settings.model;
  if (els.verbosity) els.verbosity.value = state.settings.verbosity;
  if (els.reasoning) els.reasoning.value = state.settings.reasoning;
}

function openModal(modal) {
  if (!modal || !els.modalBg) return;
  els.modalBg.hidden = false;
  modal.hidden = false;
}

function closeModals() {
  if (els.modalBg) els.modalBg.hidden = true;
  [els.settings, els.modelModal].forEach((modal) => {
    if (modal) modal.hidden = true;
  });
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function startNewChat() {
  const now = Date.now();
  const chat = {
    id: uid(),
    title: "New conversation",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  state.chats.unshift(chat);
  state.activeId = chat.id;
  saveState();
  if (els.input) els.input.value = "";
  clearAttachment();
  renderApp();
  els.input?.focus();
  closeSidebar();
}

function exportData() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gpt6-astra-chats-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Chat data exported");
}

function clearData() {
  if (!window.confirm("Clear every locally saved conversation and setting?")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(emptyState);
  ensureChat();
  renderApp();
  toast("Local data cleared");
}

function handleVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    toast("Voice input is not supported in this browser.", "error");
    return;
  }

  if (recognition) {
    recognition.stop();
    recognition = null;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = navigator.language || "en-US";
  recognition.interimResults = true;
  recognition.continuous = false;

  const base = els.input?.value || "";
  recognition.onresult = (event) => {
    const spoken = [...event.results].map((result) => result[0].transcript).join("");
    if (els.input) {
      els.input.value = `${base}${base ? " " : ""}${spoken}`.trim();
      autoSize();
    }
  };

  recognition.onerror = () => {
    toast("Voice input could not start.", "error");
    recognition = null;
  };

  recognition.onend = () => {
    recognition = null;
  };

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

  $("#new-chat")?.addEventListener("click", startNewChat);
  $("#home")?.addEventListener("click", () => {
    if (!activeChat()?.messages?.length) renderApp();
    else startNewChat();
  });
  els.search?.addEventListener("input", renderHistory);
  els.file?.addEventListener("change", (event) => setAttachment(event.target.files?.[0]));
  $("#voice")?.addEventListener("click", handleVoice);
  $("#open-settings")?.addEventListener("click", () => openModal(els.settings));
  $("#top-settings")?.addEventListener("click", () => openModal(els.settings));
  $("#model-picker")?.addEventListener("click", () => openModal(els.modelModal));
  $("#requested-model")?.addEventListener("click", () => {
    state.settings.model = DEFAULT_MODEL;
    saveState();
    renderApp();
    closeModals();
    toast("GPT-6 Astra selected");
  });
  $$(".close-modal").forEach((button) => button.addEventListener("click", closeModals));
  els.modalBg?.addEventListener("click", closeModals);

  $("#save-settings")?.addEventListener("click", () => {
    state.settings = {
      theme: els.theme?.value || "dark",
      model: els.model?.value?.trim() || DEFAULT_MODEL,
      verbosity: els.verbosity?.value || "medium",
      reasoning: els.reasoning?.value || "medium"
    };
    saveState();
    renderApp();
    closeModals();
    toast("Settings saved");
  });

  $("#export-data")?.addEventListener("click", exportData);
  $("#clear-data")?.addEventListener("click", clearData);
  $("#open-sidebar")?.addEventListener("click", () => document.body.classList.add("sidebar-open"));
  $("#close-sidebar")?.addEventListener("click", closeSidebar);
  $("#backdrop")?.addEventListener("click", closeSidebar);

  $$(".suggestions button").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt || ""));
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", applyTheme);
  }
}

function init() {
  bindEvents();
  if (!state.chats.length) ensureChat();
  renderApp();
  autoSize();
}

init();
