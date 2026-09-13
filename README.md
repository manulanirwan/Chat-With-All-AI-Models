# GPT-6 Astra

A polished ChatGPT-style browser app powered by Puter.js.

## Included

- Modern dark AI chat UI with responsive mobile layout
- Streaming responses through `puter.ai.chat()`
- Requested default model identifier: `openai/gpt-6-astra`
- Multi-turn conversation context
- Local chat history with search
- Rename conversations
- New chat and keyboard shortcuts
- Markdown rendering and fenced code blocks
- One-click code and message copying
- Regenerate the latest answer
- Edit user prompts
- Image attachment support
- Browser voice input when available
- Dark, light, and system themes
- Model, response-style, and reasoning controls
- Export local chat data as JSON
- Clear local data
- GitHub Pages-friendly static files

## Run locally

Open `index.html` in a modern browser or use VS Code Live Server.

The app loads Puter.js from its CDN:

```html
<script src="https://js.puter.com/v2/"></script>
```

Puter's current browser API supports prompt or messages-array chat calls, streaming, model selection, and media inputs. Check the official Puter.js documentation for current model availability and API details.

## GitHub Pages

In repository Settings, enable **Pages** and deploy from the `main` branch and the repository root. The site is already structured as a static app and includes `.nojekyll`.

## Notes

Conversation data is kept in this browser using `localStorage`. Do not put private API keys into this frontend. Puter may require user access or may limit model availability according to its current service rules.

## License

MIT
