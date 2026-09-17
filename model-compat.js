(() => {
  const api = window.puter?.ai;
  if (!api || typeof api.chat !== "function" || api.__gpt6AstraCompat) return;

  const originalChat = api.chat.bind(api);
  const knownProviders = new Set([
    "anthropic",
    "google",
    "xai",
    "deepseek",
    "alibaba",
    "moonshot",
    "zai",
    "mistral",
    "meta",
    "nvidia",
    "cohere",
    "openrouter",
    "together",
    "infron",
    "amazon"
  ]);

  const normalizeOptions = (options) => {
    if (!options || typeof options !== "object") return options;
    const next = { ...options };
    const model = typeof next.model === "string" ? next.model.trim() : "";

    if (model.includes("/")) {
      const slash = model.indexOf("/");
      const provider = model.slice(0, slash).toLowerCase();
      const id = model.slice(slash + 1);
      if (knownProviders.has(provider) && id) {
        next.model = id;
        next.provider = next.provider || provider;
      }
    }

    return next;
  };

  api.chat = function (...args) {
    const nextArgs = [...args];

    // puter.ai.chat(prompt, options)
    if (nextArgs.length === 2 && nextArgs[1] && typeof nextArgs[1] === "object" && !Array.isArray(nextArgs[1])) {
      nextArgs[1] = normalizeOptions(nextArgs[1]);
    }

    // puter.ai.chat(prompt, media, testMode, options)
    if (nextArgs.length >= 4 && nextArgs[3] && typeof nextArgs[3] === "object") {
      nextArgs[3] = normalizeOptions(nextArgs[3]);
    }

    // puter.ai.chat(messages, testMode, options)
    if (Array.isArray(nextArgs[0]) && nextArgs.length >= 3 && nextArgs[2] && typeof nextArgs[2] === "object") {
      nextArgs[2] = normalizeOptions(nextArgs[2]);
    }

    return originalChat(...nextArgs);
  };

  api.__gpt6AstraCompat = true;
})();
