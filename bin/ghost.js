#!/usr/bin/env node

import { loadConfig, saveConfig, toggleActive } from '../src/config/userConfig.js';
import { pingOllama } from '../src/preflight/ollamaCheck.js';
import { runCommandWithGhost } from '../src/shell/runner.js';
import { startMonitoredSession } from '../src/shell/session.js';
import { PONYTAIL_RULES_PATH, loadPonytailRules } from '../src/agent/orchestrator.js';
import { colors } from '../src/ui/boxStyles.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

async function main() {
  const config = loadConfig();

  switch (command) {
    case 'on': {
      toggleActive(true);
      console.log(`${colors.green}✓ Ghost Trace interceptor enabled.${colors.reset}`);
      await startMonitoredSession(config);
      break;
    }

    case 'off': {
      toggleActive(false);
      console.log(`${colors.yellow}✓ Ghost Trace interceptor muted. Standard terminal errors print normally.${colors.reset}`);
      break;
    }

    case 'status': {
      console.log(`\n${colors.bold}${colors.cyan}👻 GHOST IN THE MACHINE - STATUS${colors.reset}`);
      console.log(`──────────────────────────────────────────`);
      console.log(`State       : ${config.active ? `${colors.green}ACTIVE (ON)${colors.reset}` : `${colors.red}MUTED (OFF)${colors.reset}`}`);
      console.log(`Model       : ${colors.bold}${config.model}${colors.reset}`);
      console.log(`Ollama Host : ${config.ollamaHost}`);
      console.log(`Debounce    : ${config.debounceMs}ms`);
      console.log(`Max Hops    : ${config.maxHops} files`);

      // Check Ollama connectivity
      process.stdout.write(`Ollama Ping : Checking... `);
      const ping = await pingOllama(config.ollamaHost, 1500);
      if (ping.available) {
        console.log(`${colors.green}ONLINE (Found ${ping.models.length} model(s))${colors.reset}`);
      } else {
        console.log(`${colors.red}OFFLINE (${ping.error})${colors.reset}`);
      }

      // Check Ponytail rules
      const rules = loadPonytailRules();
      console.log(`Ponytail    : ${rules.includes('Ladder') || rules.includes('smallest') ? `${colors.green}BUNDLED & ACTIVE${colors.reset}` : `${colors.yellow}MISSING${colors.reset}`}`);
      console.log(`Zero-Code   : ${colors.green}ENFORCED (Strict Plain-English)${colors.reset}\n`);
      break;
    }

    case 'config': {
      const key = args[1];
      const val = args[2];
      if (!key) {
        console.log(JSON.stringify(config, null, 2));
      } else if (!val) {
        console.log(`${key} = ${config[key]}`);
      } else {
        const update = {};
        update[key] = val;
        saveConfig(update);
        console.log(`${colors.green}Updated ${key} = ${val}${colors.reset}`);
      }
      break;
    }

    case 'run': {
      const targetCmd = args.slice(1).join(' ');
      if (!targetCmd) {
        console.error('Usage: ghost run <command>');
        process.exit(1);
      }
      const exitCode = await runCommandWithGhost(targetCmd, config);
      process.exit(exitCode);
      break;
    }

    case 'help':
    default: {
      console.log(`
${colors.bold}${colors.cyan}👻 GHOST TRACE CLI - Spectral Autopsy Agent${colors.reset}
${colors.gray}Zero-code runtime crash diagnostics with Ponytail simplicity${colors.reset}

${colors.bold}USAGE:${colors.reset}
  ghost on                 Start monitored terminal session
  ghost off                Mute crash interceptor
  ghost status             Check Ollama connection & agent status
  ghost run <command...>   Run a single command with Ghost autopsy
  ghost config [key] [val] View or update local configuration

${colors.bold}EXAMPLES:${colors.reset}
  ghost run npm run dev
  ghost run python app.py
  ghost run node server.js
  ghost config model llama3.1:8b
`);
      break;
    }
  }
}

main().catch((err) => {
  console.error(`\nFatal error: ${err.message}`);
  process.exit(1);
});
