# 👻 ghost-trace-cli

> **Ghost in the Machine: Autonomous, local-first terminal autopsy agent with Ponytail simplicity and zero-code guardrails.**

`ghost-trace-cli` is an open-source, globally installable CLI tool (`npm install -g ghost-trace-cli`) that runs inside any terminal (VS Code, Windows Terminal, iTerm2, Kitty).

Instead of acting as a copy-paste code generator that hinders learning, `ghost-trace-cli` acts as an autonomous, read-only "Spectral Autopsy" agent. Whenever an error or crash occurs across a complex full-stack project, the tool intercepts the stack trace, investigates the project files to backtrack the chain of errors, and displays a structured diagnostic report at the bottom of the terminal.

---

## 🔒 The Zero-Code Mandate

The tool **strictly never outputs code syntax, code snippets, or copy-paste fixes**. It only outputs:
1. **The exact corrupted / faulty files and line numbers** in the failure chain.
2. **How the failure cascaded** from the origin file to the crash site.
3. **A step-by-step plain-English debugging plan** telling the developer which files to fix in which exact order, and what logic/state to fix.

Developers can take this conceptual guidance to ChatGPT, Gemini, or fix it by hand to truly understand their architecture and learn debugging.

---

## 🧘 Native Ponytail Anti-Over-Engineering Integration

`ghost-trace-cli` natively bundles the **Ponytail** ruleset (`src/agent/ponytail-rules.txt`) into its core prompt engine. When diagnosing a crash:
- It applies the **Ladder of Laziness**: first checks if the logic is needed, reuses existing codebase patterns, reaches for standard library features, and enforces the smallest complete fix.
- It champions **deletion over addition**: recommends removing dead or redundant branches rather than inventing complex wrappers or adding external dependencies.

---

## 🚀 Quick Start

### 1. Requirements
- Node.js `>= 18.0.0`
- [Ollama](https://ollama.com) running locally with `qwen2.5-coder:7b` or `llama3.1:8b` (Ghost Trace will prompt with install commands if Ollama is not yet installed).

### 2. Global Installation
```bash
npm install -g ghost-trace-cli
```
*(Zero native C++ compilation bindings; installs cleanly on Windows, macOS, and Linux without node-gyp).*

### 3. Usage & Commands

```bash
# Start an interactive monitored terminal session
ghost on

# Mute the interceptor
ghost off

# Check Ollama connection & agent status
ghost status

# Run any command directly under Ghost supervision
ghost run npm run dev
ghost run node server.js
ghost run python app.py

# Configure local options
ghost config model llama3.1:8b
ghost config debounceMs 600
```

---

## 📋 Exact Terminal Autopsy Output

```
╭─────────────────── 👻 GHOST IN THE MACHINE: AUTOPSY REPORT ───────────────────╮
│                                                                               │
│ 🔍 AGENT INVESTIGATION TRAIL                                                  │
│   Inspected 3 files across 2 directories to trace the failure chain.          │
│                                                                               │
│ ⚠️ CORRUPTED / FAULTY FILES DETECTED (3 Files in Chain)                       │
│   • [Origin]      backend/utils/envParser.js          (Line 19)               │
│   • [Propagation] backend/services/aiProvider.js      (Line 34)               │
│   • [Crash Site]  backend/routes/generate.route.js    (Line 62)               │
│                                                                               │
│ 🔗 CHAIN OF ERRORS (How the failure cascaded)                                 │
│   1. backend/utils/envParser.js (Line 19)                                     │
│      └─ Reads the provider timeout environment variable, but returns a        │
│         string instead of converting it to an integer, and does not fallback  │
│         when the variable is missing.                                         │
│   2. backend/services/aiProvider.js (Line 34)                                 │
│      └─ Passes that unvalidated timeout value directly into the HTTP client   │
│         initialization, causing the client instance to silently fail setup.   │
│   3. backend/routes/generate.route.js (Line 62)                               │
│      └─ Attempts to invoke the request method on the uninitialized client     │
│         instance, triggering the fatal TypeError shown above.                 │
│                                                                               │
│ 🛠️ STEP-BY-STEP DEBUGGING PLAN (Solve in this exact order)                    │
│                                                                               │
│   STEP 1: Solve `backend/utils/envParser.js` (Line 19)                        │
│   • What to fix: Ensure the environment variable parser explicitly casts      │
│     the timeout value to a numeric type and provides a default fallback       │
│     number if the key is undefined in your environment configuration.         │
│                                                                               │
│   STEP 2: Solve `backend/services/aiProvider.js` (Line 34)                    │
│   • What to fix: Add a guard check before initializing the AI service         │
│     client to verify that all required configuration parameters (API key      │
│     and timeout) are valid and present.                                       │
│                                                                               │
│   STEP 3: Solve `backend/routes/generate.route.js` (Line 62)                  │
│   • What to fix: Wrap the external service call in an error-handling block    │
│     so that downstream service failures return a structured HTTP error        │
│     response instead of crashing the entire server process.                   │
│                                                                               │
╰───────────────────────────────────────────────────────────────────────────────╯
```

---

## 🛡️ Privacy & Secret Sanitization
Ghost Trace never sends code outside your machine. Additionally, an automatic pre-flight scrubber redacts:
- API keys (`sk-...`, `ghp_...`, `AKIA...`)
- Bearer tokens & JWTs
- Database connection strings (`postgres://...`, `mongodb://...`)
- `.env` secrets and credentials

---

## 🧪 Testing

```bash
cd C:\ghost_trace_cli
npm test
```

Tests run using Node.js's native test runner (`node --test`), verifying trace parsing, multi-file symbol backtracking, secret scrubbing, aggressive zero-code stripping, and Ponytail prompt injection.

---

## 📄 License
MIT
