import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeAutopsyPayload } from './validator.js';
import { scrubSecrets } from '../security/secretScrubber.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PONYTAIL_RULES_PATH = path.join(__dirname, 'ponytail-rules.txt');

export function loadPonytailRules() {
  try {
    return fs.readFileSync(PONYTAIL_RULES_PATH, 'utf8').trim();
  } catch (err) {
    return `You are a lazy senior developer. The best code is the code never written. Solve the whole problem with the least new code. Deletion over addition. Standard library over new packages.`;
  }
}

export function buildSystemPrompt() {
  const ponytailRules = loadPonytailRules();

  return `You are Ghost Autopsy, an autonomous terminal diagnostic agent.

${ponytailRules}

STRICT ZERO-CODE MANDATE:
1. You must NEVER output code blocks, code syntax, variable assignments, function definitions, or copy-paste fixes.
2. Under "what_went_wrong" and "action_instruction", explain the issue and the fix using PLAIN-ENGLISH CONCEPTS ONLY.
3. Suggest the minimal, simplest fix following the Ponytail principles above (deletion over addition, standard language features over new wrappers or packages).
4. Do not suggest adding new libraries, configuration frameworks, or complex abstractions.
5. Return ONLY a valid JSON object matching the requested schema.`;
}

export function buildDiagnosticPrompt(parsedTrace, failureChain) {
  const chainContext = failureChain.chain.map(f => {
    return `[Role: ${f.role}] File: ${f.file_path} (Line ${f.line_number})
Code Context:
${f.snippet}
`;
  }).join('\n---\n');

  return `CRASH DETAILS:
Error: ${parsedTrace.errorType}: ${parsedTrace.errorMessage}
Crash Site: ${parsedTrace.crashSite.relativePath}:${parsedTrace.crashSite.lineNumber}

VERIFIED PROJECT CODE CASCADE:
${chainContext}

TASK:
Analyze how the defect cascaded from the Origin through Propagation to the Crash Site.
Following Ponytail's Ladder of Simplicity, formulate the smallest, simplest plain-English debugging plan.
Do NOT output any code syntax.

Return a JSON object with this exact schema:
{
  "files_inspected_count": ${failureChain.files_inspected_count},
  "corrupted_files": [
    {
      "role": "Origin | Propagation | Crash Site",
      "file_path": "string",
      "line_number": 123
    }
  ],
  "error_chain": [
    {
      "step_number": 1,
      "file_path": "string",
      "line_number": 123,
      "what_went_wrong": "Plain English explanation of what went wrong at this line. No code syntax."
    }
  ],
  "step_by_step_resolution": [
    {
      "order": 1,
      "target_file": "string",
      "target_line": 123,
      "action_instruction": "Plain English conceptual instruction on what to fix. No code syntax."
    }
  ]
}`;
}

export async function runAutopsyAgent(parsedTrace, failureChain, config) {
  const host = config.ollamaHost || 'http://localhost:11434';
  const model = config.model || 'qwen2.5-coder:7b';

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildDiagnosticPrompt(parsedTrace, failureChain);

  try {
    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: userPrompt,
        system: systemPrompt,
        format: 'json',
        stream: false,
        options: {
          temperature: 0.2,
          top_p: 0.9
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama API returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const rawResponse = data.response;

    // Pass through Aggressive Zero-Code Sanitizer Gate
    return sanitizeAutopsyPayload(rawResponse, failureChain);
  } catch (err) {
    // If Ollama is unreachable or fails mid-run, generate a deterministic fallback autopsy
    // so the developer still gets an accurate report of the corrupted files and lines
    return generateDeterministicFallback(parsedTrace, failureChain);
  }
}

function generateDeterministicFallback(parsedTrace, failureChain) {
  const corrupted = failureChain.chain.map(f => ({
    role: f.role,
    file_path: f.file_path,
    line_number: f.line_number
  }));

  const chain = failureChain.chain.map((f, idx) => ({
    step_number: idx + 1,
    file_path: f.file_path,
    line_number: f.line_number,
    what_went_wrong: f.role === 'Crash Site'
      ? `Encountered ${parsedTrace.errorType}: ${parsedTrace.errorMessage}`
      : `Passed state upstream without validating type or existence.`
  }));

  const steps = failureChain.chain.map((f, idx) => ({
    order: idx + 1,
    target_file: f.file_path,
    target_line: f.line_number,
    action_instruction: f.role === 'Origin'
      ? 'Ensure fallback default values are present and validate types at the entry point.'
      : f.role === 'Propagation'
      ? 'Add a boundary check before passing parameters to dependent services.'
      : 'Handle error conditions gracefully to prevent crashing the host process.'
  }));

  return {
    files_inspected_count: failureChain.files_inspected_count,
    corrupted_files: corrupted,
    error_chain: chain,
    step_by_step_resolution: steps
  };
}
