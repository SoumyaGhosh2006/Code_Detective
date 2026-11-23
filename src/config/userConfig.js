import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DEFAULTS } from './defaults.js';

const CONFIG_PATH = path.join(os.homedir(), '.ghost-trace.json');

export function getConfigPath() {
  return CONFIG_PATH;
}

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (err) {
    // Fall back to defaults on corrupt config file
  }
  return { ...DEFAULTS };
}

export function saveConfig(updates = {}) {
  const current = loadConfig();
  const merged = { ...current, ...updates };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    // If saving fails due to permissions, return merged in-memory
  }
  return merged;
}

export function toggleActive(isActive) {
  return saveConfig({ active: Boolean(isActive) });
}
