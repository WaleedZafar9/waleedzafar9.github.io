# site-agent

A small local agent: give it a plain-English instruction, it edits your
website/Worker files using a free LLM, then commits, pushes, and (if needed)
runs `wrangler deploy`.

This runs **on your own machine** — it needs your local git credentials and
your `wrangler` login, which a hosted chat can't access on your behalf.

## 1. Setup

```bash
# from inside this agent folder
npm install

cp .env.example .env
# then edit .env and paste in a free Groq or OpenRouter API key
```

Get a free key:
- Groq: https://console.groq.com/keys
- OpenRouter: https://openrouter.ai/keys (look for models tagged `:free`)

## 2. Where this folder goes

This is already configured for the `waleedzafar9.github.io` repo layout:

```
waleedzafar9.github.io/     ← git repo root
├── index.html
├── style.css
├── script.js
├── mypp.png
├── photo.png
├── README.md
├── ask-waleed-ai/           ← the Cloudflare Worker
│   ├── src/
│   │   └── index.js
│   ├── wrangler.jsonc
│   └── package.json
└── site-agent/              ← 📁 put THIS folder here (unzip/copy it in)
    ├── agent.js
    ├── package.json
    ├── .env.example
    └── README.md
```

Place the `site-agent` folder at the **root of `waleedzafar9.github.io`**,
as a sibling of `ask-waleed-ai/`, not inside it.

`agent.js` already has the right `FILES` list for this layout:

```js
const FILES = [
  "index.html",
  "style.css",
  "script.js",
  "ask-waleed-ai/src/index.js",
  "ask-waleed-ai/wrangler.jsonc",
];
```

Because the agent runs from inside `site-agent/` but needs to edit files one
level up, set this in your `.env`:

```
REPO_PATH=..
```

Make sure, from your terminal, `git push` and `npx wrangler deploy` already
work manually in this repo (i.e. you're logged into git and `wrangler login`
has been run once in `ask-waleed-ai/`). The agent just runs the same commands
you'd run by hand.

## 3. Use it

```bash
# preview only — no files written, no push, no deploy
node agent.js "add a small badge next to the hero title that says 'Open to freelance work'" --dry-run

# apply the change, commit, and push (site), but don't deploy the worker
node agent.js "make the testimonial cards auto-rotate every 6 seconds"

# apply + push + deploy (only deploys if worker/ files were touched)
node agent.js "update the system prompt to mention the new AI Writing Assistant is now live"
```

Flags:
- `--dry-run` — show proposed file contents, don't write/commit/push/deploy
- `--no-push` — write files locally but skip git commit/push
- `--no-deploy` — skip `wrangler deploy` even if worker files changed

## How it works

1. Reads the current content of every file in `FILES`.
2. Sends them + your instruction to the LLM with a strict system prompt
   asking for JSON back: which files changed, and their full new content.
3. Writes those files to disk.
4. `git add -A && git commit -m "<summary>" && git push`
5. If any file under `worker/` changed, runs `npx wrangler deploy`.

## Honest limitations (free models vs. Claude Code)

Free 70B-class models via Groq/OpenRouter are solid for scoped, well-described
changes (copy tweaks, adding a section, styling changes, small logic fixes).
They're noticeably weaker than Claude at:
- large multi-file refactors
- instructions that require inferring a lot of unstated context
- strictly following the "full file content, valid JSON only" contract —
  occasionally you'll need to re-run if it returns malformed JSON or leaves
  out an expected file

Always review a real diff before trusting `--dry-run` output, and consider
running `git diff` after a real (non-dry-run) run before you fully trust it
unattended. For anything you don't want to double-check by hand, Claude Code
(paid, but far more reliable at this exact loop) is the safer choice.

## Security notes

- `.env` holds your API key — it's already gitignored-style by convention,
  but double check it's not committed.
- The agent has write access to whatever paths are in `FILES`. Keep that
  list scoped to files you're comfortable letting an LLM edit unattended.
- Consider always running with `--dry-run` first until you trust its output
  on your specific codebase.
