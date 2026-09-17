# Chat With Powerful AI Models

One browser workspace for 20 curated AI models. Switch models in the same chat, keep history locally, and run everything as a static site.

**Live site:** [https://manulanirwan.github.io/Chat-With-All-AI-Models/](https://manulanirwan.github.io/Chat-With-All-AI-Models/)

Powered by [Puter.js](https://developer.puter.com/). No provider API keys are stored in this repo.

## Features

- Dark workspace with a desktop sidebar and a mobile drawer
- 20-model catalog with live Puter availability checks
- Instant model switching from the sidebar, top bar, or model deck
- Streaming replies through `puter.ai.chat()`
- Multi-turn conversation context
- Local chat history in `localStorage`
- Rename chats, start a new chat, and use `Ctrl + K`
- Image attachments and browser voice input when the browser supports it
- Dark, light, and system themes
- Response style and reasoning controls
- Export chats as JSON and clear local data
- GitHub Pages ready, with `.nojekyll` included

## Models

The workspace ships with these curated names. A model can be selected only when Puter currently exposes it.

| Model | Provider |
| --- | --- |
| GPT-6 Astra | OpenAI |
| GPT-5.6 Cyber | OpenAI |
| Claude Fable 5.1 | Anthropic |
| Claude Mythos 5.1 | Anthropic |
| Claude Opus 5 | Anthropic |
| Gemini 3.8 Flash | Google |
| Gemini 3.8 Flash Cyber | Google |
| Grok 4.6 | xAI |
| DeepSeek V4.1 Flash | DeepSeek |
| DeepSeek V4 Pro | DeepSeek |
| Qwen3.8-Max | Alibaba |
| Qwen3.8 Flash-Next | Alibaba |
| Kimi K3 | Moonshot AI |
| GLM-5.3 | Z.ai |
| GLM-5.3 Flash | Z.ai |
| Muse Spark 1.3 | Meta |
| Nemotron 3 Ultra | NVIDIA |
| Mistral Medium 3.5 | Mistral AI |
| Command A+ | Cohere |
| Atria Dawn Preview | Atria |

The default requested model id is `openai/gpt-6-astra`.

## Run locally

Open `index.html` in a modern browser, or use VS Code Live Server.

Puter.js is loaded from the official CDN:

```html
<script src="https://js.puter.com/v2/"></script>
```

## Project files

| File | Role |
| --- | --- |
| `index.html` | App shell and branding |
| `styles.css` | Base theme |
| `final-ui.css` | Main visual system |
| `layout-fix.css` | Full-width layout and type sizes |
| `script.js` | Chat, history, settings, Puter calls |
| `model-ui-patches.js` | Model deck and layout helpers |
| `favicon.svg` | App icon |

## GitHub Pages

In repository Settings, enable **Pages**. Deploy from the `main` branch and the repository root. This project is a static site.

## Privacy

Chats stay in this browser through `localStorage`. Do not put private API keys in the frontend. Puter may ask the user to sign in and may limit which models are available.

## License

MIT
