import os from 'node:os';
import { spawn } from 'node:child_process';
import { StreamBuffer } from './streamBuffer.js';
import { pingOllama, getInstallInstructions } from '../preflight/ollamaCheck.js';
import { parseStackTrace } from '../agent/traceParser.js';
import { backtrackFailureChain } from '../agent/symbolFollower.js';
import { runAutopsyAgent } from '../agent/orchestrator.js';
import { renderAutopsyReport } from '../ui/renderer.js';
import { colors } from '../ui/boxStyles.js';

export async function startMonitoredSession(config) {
  // Preflight check
  const preflight = await pingOllama(config.ollamaHost);
  if (!preflight.available) {
    console.log(getInstallInstructions(config.model));
    console.log('\n[ghost] Launching monitored shell without AI autopsy...\n');
  }

  const isWin = os.platform() === 'win32';
  const defaultShell = isWin
    ? (process.env.COMSPEC || 'powershell.exe')
    : (process.env.SHELL || '/bin/bash');

  console.log(`${colors.cyan}👻 [Ghost in the Machine] Monitored terminal active.${colors.reset}`);
  console.log(`${colors.gray}Zero-Code Autopsy & Ponytail rules enabled. Type 'exit' to quit.${colors.reset}\n`);

  const streamBuffer = new StreamBuffer(config.bufferLines, config.debounceMs);
  let isAnalyzing = false;

  async function triggerAutopsy() {
    if (isAnalyzing) return;
    const bufferText = streamBuffer.getBufferText();
    const parsedTrace = parseStackTrace(bufferText, process.cwd());

    if (!parsedTrace || !parsedTrace.crashSite) return;

    isAnalyzing = true;
    streamBuffer.cancelDebouncedCrash();

    const failureChain = backtrackFailureChain(parsedTrace, process.cwd(), config.maxHops);
    if (!failureChain || failureChain.chain.length === 0) {
      isAnalyzing = false;
      return;
    }

    try {
      console.log('\n👻 [Ghost] Investigating crash across project files...\n');
      const reportPayload = await runAutopsyAgent(parsedTrace, failureChain, config);
      const renderedBox = renderAutopsyReport(reportPayload);
      console.log('\n' + renderedBox + '\n');
    } catch (err) {
      console.error(`\n👻 [Ghost Error] Failed to generate autopsy: ${err.message}\n`);
    } finally {
      isAnalyzing = false;
    }
  }

  streamBuffer.on('debounced-crash', () => {
    triggerAutopsy();
  });

  return new Promise((resolve) => {
    const child = spawn(defaultShell, [], {
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GHOST_ACTIVE: '1'
      }
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      streamBuffer.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      streamBuffer.write(chunk);
    });

    child.on('exit', (code) => {
      console.log(`\n${colors.cyan}👻 [Ghost in the Machine] Shell session ended.${colors.reset}`);
      resolve(code || 0);
    });
  });
}
