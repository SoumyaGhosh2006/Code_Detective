import os from 'node:os';

export async function pingOllama(host = 'http://localhost:11434', timeoutMs = 2000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${host}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { available: false, error: `HTTP ${res.status}: ${res.statusText}`, models: [] };
    }

    const data = await res.json();
    const models = Array.isArray(data.models) ? data.models.map(m => m.name) : [];
    return { available: true, models };
  } catch (err) {
    clearTimeout(timer);
    return {
      available: false,
      error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
      models: []
    };
  }
}

export function getInstallInstructions(targetModel = 'qwen2.5-coder:7b') {
  const platform = os.platform();
  let cmd = 'curl -fsSL https://ollama.com/install.sh | sh';

  if (platform === 'win32') {
    cmd = 'winget install Ollama.Ollama';
  } else if (platform === 'darwin') {
    cmd = 'brew install ollama';
  }

  return [
    '╭──────────────────────── 👻 GHOST: OLLAMA REQUIRED ────────────────────────╮',
    '│ Local Ollama was not detected on http://localhost:11434.                   │',
    '│ Ghost Trace operates 100% locally to protect your code and keep it free.  │',
    '│                                                                            │',
    '│ Install Ollama on your machine:                                            │',
    `│   • Install command : ${cmd.padEnd(52)} │`,
    `│   • Pull model      : ollama pull ${targetModel.padEnd(41)} │`,
    '│   • Start service   : ollama serve                                         │',
    '│                                                                            │',
    '│ Once Ollama is running, re-run your command with Ghost Trace!             │',
    '╰────────────────────────────────────────────────────────────────────────────╯'
  ].join('\n');
}

export function getMissingModelInstructions(targetModel = 'qwen2.5-coder:7b') {
  return [
    '╭───────────────────── 👻 GHOST: MODEL PULL REQUIRED ──────────────────────╮',
    `│ Ollama is running, but model "${targetModel}" is not downloaded yet.       │`,
    '│                                                                            │',
    `│ Run this in your terminal to download the open-weight model:              │`,
    `│   ollama pull ${targetModel.padEnd(60)} │`,
    '│                                                                            │',
    '│ Once finished, Ghost Trace will autonomously analyze crashes with it.     │',
    '╰────────────────────────────────────────────────────────────────────────────╯'
  ].join('\n');
}
