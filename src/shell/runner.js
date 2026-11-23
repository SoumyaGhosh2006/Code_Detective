import { spawn } from 'node:child_process';
import { StreamBuffer } from './streamBuffer.js';
import { pingOllama, getInstallInstructions } from '../preflight/ollamaCheck.js';
import { parseStackTrace } from '../agent/traceParser.js';
import { backtrackFailureChain } from '../agent/symbolFollower.js';
import { runAutopsyAgent } from '../agent/orchestrator.js';
import { renderAutopsyReport } from '../ui/renderer.js';

export async function runCommandWithGhost(commandString, config) {
  if (!commandString || typeof commandString !== 'string') {
    console.error('Error: No command specified for "ghost run".');
    process.exit(1);
  }

  // Pre-flight check
  const preflight = await pingOllama(config.ollamaHost);
  if (!preflight.available) {
    console.log(getInstallInstructions(config.model));
    console.log('\n[ghost] Running command without AI autopsy...\n');
  }

  const streamBuffer = new StreamBuffer(config.bufferLines, config.debounceMs);
  let autopsyTriggered = false;

  async function triggerAutopsy(reason = 'exit') {
    if (autopsyTriggered) return;
    const bufferText = streamBuffer.getBufferText();
    const parsedTrace = parseStackTrace(bufferText, process.cwd());

    if (!parsedTrace || !parsedTrace.crashSite) {
      return;
    }

    autopsyTriggered = true;
    streamBuffer.cancelDebouncedCrash();

    const failureChain = backtrackFailureChain(parsedTrace, process.cwd(), config.maxHops);
    if (!failureChain || failureChain.chain.length === 0) {
      return;
    }

    try {
      console.log('\n👻 [Ghost] Investigating crash across project files...\n');
      const reportPayload = await runAutopsyAgent(parsedTrace, failureChain, config);
      const renderedBox = renderAutopsyReport(reportPayload);
      console.log('\n' + renderedBox + '\n');
    } catch (err) {
      console.error(`\n👻 [Ghost Error] Failed to generate autopsy: ${err.message}\n`);
    }
  }

  // Listen for debounced crash in continuous dev servers
  streamBuffer.on('debounced-crash', () => {
    triggerAutopsy('dev-server-debounce');
  });

  return new Promise((resolve) => {
    const child = spawn(commandString, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe']
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      streamBuffer.write(chunk);
    });

    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      streamBuffer.write(chunk);
    });

    child.on('error', (err) => {
      console.error(`Failed to start command: ${err.message}`);
      resolve(1);
    });

    child.on('exit', async (code, signal) => {
      if (code !== 0 && code !== null) {
        await triggerAutopsy('non-zero-exit');
      }
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}
