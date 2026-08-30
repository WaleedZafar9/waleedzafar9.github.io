#!/usr/bin/env node
/**
 * agent.js — instruction-to-code-to-deploy agent
 * ------------------------------------------------
 * Usage:
 *   node agent.js "add a dark-mode toggle animation to the hero"
 *   node agent.js "add a new stat card showing 10+ commits" --dry-run
 *   node agent.js "fix the mobile nav overflow bug" --no-push
 *
 * Reads config from .env (see .env.example).
 * Full flow:
 *   1. Reads the current content of every file listed in FILES (below).
 *   2. Sends them + your instruction to a free LLM (Groq or OpenRouter).
 *   3. Model returns strict JSON describing which files to change and how.
 *   4. Script writes the files locally.
 *   5. git add -A && git commit && git push (unless --no-push or --dry-run)
 *   6. If any WORKER_FILES were touched, runs `wrangler deploy`
 *      (unless --no-deploy or --dry-run)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
require("dotenv").config();

// ---------------------------------------------------------------------------
// CONFIG — edit these paths to match your repo layout
// ---------------------------------------------------------------------------

// Repo root the agent should operate in (defaults to current directory)
const REPO_PATH = process.env.REPO_PATH || process.cwd();

// All files the agent is allowed to read + edit.
// Add/remove paths here as your project grows.
const FILES = [
  "index.html",
  "style.css",
  "script.js",
  "ask-waleed-ai/src/index.js",
  "ask-waleed-ai/wrangler.jsonc",
];

// Any file under these paths, if changed, triggers `wrangler deploy`
// (run from WORKER_DIR).
const WORKER_DIR = "ask-waleed-ai";
const WORKER_FILE_PREFIX = "ask-waleed-ai/";

// ---------------------------------------------------------------------------
// LLM PROVIDERS — all OpenAI-compatible chat APIs
// ---------------------------------------------------------------------------

const PROVIDERS = {
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    key: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  },
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    key: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "poolside/laguna-s-2.1:free",
  },
};

// Order to try providers in. Set PROVIDER_ORDER="gemini,groq" in .env to
// customize. Providers without an API key set are skipped automatically,
// so it's safe to leave all three listed even if you've only set one key.
const requestedOrder = (process.env.PROVIDER_ORDER || process.env.LLM_PROVIDER || "gemini,groq,openrouter")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const PROVIDER_ORDER = requestedOrder.filter((name) => {
  if (!PROVIDERS[name]) {
    console.warn(`Ignoring unknown provider "${name}" in PROVIDER_ORDER.`);
    return false;
  }
  return Boolean(PROVIDERS[name].key);
});

if (PROVIDER_ORDER.length === 0) {
  console.error(
    "No usable providers found. Set at least one of GEMINI_API_KEY, GROQ_API_KEY, " +
      "or OPENROUTER_API_KEY in .env (see .env.example)."
  );
  process.exit(1);
}

// How many attempts (retries) per provider before falling through to the
// next one, and the base delay between retries (doubles each attempt).
const MAX_ATTEMPTS_PER_PROVIDER = Number(process.env.MAX_ATTEMPTS_PER_PROVIDER || 3);
const RETRY_BASE_DELAY_MS = Number(process.env.RETRY_BASE_DELAY_MS || 1500);

// HTTP status codes worth retrying (overload / rate limit / transient server error)
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// CLI ARGS
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const instruction = args.filter((a) => !a.startsWith("--")).join(" ").trim();

if (!instruction) {
  console.error('Usage: node agent.js "your instruction here" [--dry-run] [--no-push] [--no-deploy]');
  process.exit(1);
}

const DRY_RUN = flags.has("--dry-run");
const NO_PUSH = flags.has("--no-push") || DRY_RUN;
const NO_DEPLOY = flags.has("--no-deploy") || DRY_RUN;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function readRepoFiles() {
  const contents = {};
  for (const rel of FILES) {
    const full = path.join(REPO_PATH, rel);
    if (fs.existsSync(full)) {
      contents[rel] = fs.readFileSync(full, "utf8");
    } else {
      contents[rel] = null; // file doesn't exist yet — model can create it
    }
  }
  return contents;
}

function buildPrompt(instruction, fileContents) {
  const fileBlocks = Object.entries(fileContents)
    .map(([relPath, content]) => {
      if (content === null) return `### ${relPath}\n(file does not exist yet)`;
      return `### ${relPath}\n\`\`\`\n${content}\n\`\`\``;
    })
    .join("\n\n");

  const system = `You are a careful coding agent that edits files in a small personal
portfolio website + Cloudflare Worker project. You will be given the full
current contents of every editable file, and one instruction describing a
change to make.

Rules:
- Only change what's needed to satisfy the instruction. Preserve existing
  structure, style, and formatting conventions in each file.
- You may edit multiple files if the change requires it (e.g. HTML + CSS).
- Never invent new files outside the given list unless the instruction
  explicitly asks for a new file at a specific path.
- Return ONLY valid JSON. No markdown fences, no commentary, no explanation
  text outside the JSON object.

Output format (strict JSON):
{
  "commit_message": "short, imperative git commit message",
  "summary": "1-2 sentence plain-English summary of what you changed",
  "files": [
    { "path": "index.html", "content": "<full new file content>" }
  ]
}

Only include files in the "files" array that you actually changed. Always
return the FULL new content of each changed file, not a diff or snippet.`;

  const user = `Instruction: ${instruction}

Current files:

${fileBlocks}`;

  return { system, user };
}

// Your files run up to ~30KB (style.css, index.html). Since the model must
// echo back the FULL content of every changed file inside JSON, the output
// budget needs real headroom — 8000 tokens was cutting off mid-file.
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 24000);

async function callLLM(providerName, system, user) {
  const cfg = PROVIDERS[providerName];
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`${providerName} API error (${res.status}): ${text}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const raw = choice?.message?.content;
  if (!raw) throw new Error(`No content returned from ${providerName}.`);

  if (choice.finish_reason === "length") {
    const err = new Error(
      `${providerName} response was cut off (hit the ${MAX_OUTPUT_TOKENS}-token output limit) before finishing. ` +
        `Raise MAX_OUTPUT_TOKENS in .env, or narrow the instruction to touch fewer/smaller files.`
    );
    err.truncated = true;
    throw err;
  }

  return raw;
}

// Tries each provider in PROVIDER_ORDER. Within a provider, retries with
// backoff on transient HTTP errors (overload/rate-limit) and re-prompts on
// invalid JSON, up to MAX_ATTEMPTS_PER_PROVIDER times, before moving on.
async function getModelResult(system, user) {
  const errors = [];

  for (const providerName of PROVIDER_ORDER) {
    const cfg = PROVIDERS[providerName];
    console.log(`\n[2/5] Trying ${providerName} (${cfg.model})...`);

    let userPrompt = user;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
      try {
        const raw = await callLLM(providerName, system, userPrompt);
        const parsed = parseModelJSON(raw); // throws on invalid JSON
        return { result: parsed, provider: providerName };
      } catch (err) {
        const isRetryableHttp = typeof err.status === "number" && RETRYABLE_STATUS.has(err.status);
        const isJsonError = /did not return valid JSON|missing a "files" array/i.test(err.message);
        const lastAttempt = attempt === MAX_ATTEMPTS_PER_PROVIDER;

        console.warn(`  attempt ${attempt}/${MAX_ATTEMPTS_PER_PROVIDER} failed: ${err.message.split("\n")[0]}`);
        errors.push(`${providerName} (attempt ${attempt}): ${err.message.split("\n")[0]}`);

        if (lastAttempt) break; // give up on this provider, fall through to next

        if (isJsonError) {
          // Re-prompt with a stricter reminder, same provider, no delay needed
          userPrompt = `${user}\n\nIMPORTANT: Your previous response was not valid JSON, or was missing the "files" array. Return ONLY a single valid JSON object as specified above — no markdown fences, no commentary, no text outside the JSON.`;
          continue;
        }

        if (isRetryableHttp || err.truncated || !err.status) {
          // Transient overload/rate-limit/network error, or a truncated
          // response — back off and retry same provider.
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          console.log(`  retrying ${providerName} in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // Non-retryable error (e.g. bad API key, 404 model not found) — no point
        // retrying this provider, move straight to the next one.
        break;
      }
    }

    console.warn(`  giving up on ${providerName}, trying next provider (if any)...`);
  }

  throw new Error(
    `All providers failed:\n  ${errors.join("\n  ")}\n\n` +
      `Configured provider order: ${PROVIDER_ORDER.join(", ")}. ` +
      `Add another provider's API key in .env for more fallback options.`
  );
}

function parseModelJSON(raw) {
  const attempts = [];

  // Attempt 1: strip markdown fences and parse directly
  const cleaned = raw
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  attempts.push(cleaned);

  // Attempt 2: some models add a sentence or two before/after the JSON
  // despite instructions not to. Extract the outermost {...} block.
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(raw.slice(firstBrace, lastBrace + 1));
  }

  let parsed = null;
  let lastErr = null;
  for (const candidate of attempts) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!parsed) {
    console.error("\n--- RAW MODEL OUTPUT (failed to parse as JSON) ---\n");
    console.error(raw);
    console.error(`\n--- parse error: ${lastErr?.message} ---\n`);
    throw new Error("Model did not return valid JSON. See raw output above.");
  }
  if (!parsed.files || !Array.isArray(parsed.files)) {
    console.error("\n--- RAW MODEL OUTPUT (parsed but missing files array) ---\n");
    console.error(raw);
    throw new Error('Model JSON missing a "files" array.');
  }
  return parsed;
}

function writeFiles(files) {
  for (const f of files) {
    const full = path.join(REPO_PATH, f.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.content, "utf8");
    console.log(`  wrote ${f.path}`);
  }
}

function run(cmd, cwd) {
  console.log(`  $ ${cmd}`);
  return execSync(cmd, { cwd: cwd || REPO_PATH, stdio: "inherit" });
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

(async () => {
  console.log(`\n[1/5] Reading repo files from ${REPO_PATH}...`);
  const fileContents = readRepoFiles();

  console.log(`      Instruction: "${instruction}"`);
  console.log(`      Provider fallback order: ${PROVIDER_ORDER.join(" -> ")}`);
  const { system, user } = buildPrompt(instruction, fileContents);
  const { result, provider } = await getModelResult(system, user);

  console.log(`\n[3/5] Succeeded via ${provider}. Summary: ${result.summary || "(no summary given)"}`);
  console.log(`      Files to change: ${result.files.map((f) => f.path).join(", ") || "(none)"}`);

  if (result.files.length === 0) {
    console.log("\nNo changes proposed. Exiting.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n--dry-run set: not writing files. Preview of new content below.\n");
    for (const f of result.files) {
      console.log(`===== ${f.path} =====`);
      console.log(f.content);
      console.log("");
    }
    return;
  }

  console.log(`\n[4/5] Writing files...`);
  writeFiles(result.files);

  const touchedWorker = result.files.some((f) => f.path.startsWith(WORKER_FILE_PREFIX));

  if (!NO_PUSH) {
    console.log(`\n[5/5] Committing and pushing...`);
    const msg = (result.commit_message || `agent: ${instruction}`).replace(/"/g, '\\"');
    run(`git add -A`);
    try {
      run(`git commit -m "${msg}"`);
    } catch {
      console.log("  Nothing to commit (files unchanged after write).");
    }
    run(`git push`);
  } else {
    console.log(`\n[5/5] Skipping git commit/push (--no-push or --dry-run).`);
  }

  if (touchedWorker && !NO_DEPLOY) {
    console.log(`\nWorker files changed — running wrangler deploy...`);
    run(`npx wrangler deploy`, path.join(REPO_PATH, WORKER_DIR));
  } else if (touchedWorker) {
    console.log(`\nWorker files changed but --no-deploy set — skipping wrangler deploy.`);
  }

  console.log(`\nDone.`);
})().catch((err) => {
  console.error("\nAgent failed:", err.message);
  process.exit(1);
});