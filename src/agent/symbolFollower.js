import fs from 'node:fs';
import path from 'node:path';
import { isSafePath, toRelativeSafePath } from '../security/pathGuard.js';
import { scrubSecrets } from '../security/secretScrubber.js';

const IMPORT_REQUIRE_REGEX = /(?:import\s+(?:(?:{[^}]+}|[A-Za-z0-9_$]+|\*\s+as\s+[A-Za-z0-9_$]+)\s+from\s+)?['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|from\s+([A-Za-z0-9_.]+)\s+import)/g;

function readSafeFileLines(absPath, targetLine, window = 12) {
  if (!fs.existsSync(absPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(absPath, 'utf8');
    const allLines = content.split(/\r?\n/);
    const start = Math.max(1, targetLine - window);
    const end = Math.min(allLines.length, targetLine + window);

    const snippetLines = [];
    for (let i = start; i <= end; i++) {
      snippetLines.push(`${i}: ${allLines[i - 1]}`);
    }

    return {
      totalLines: allLines.length,
      startLine: start,
      endLine: end,
      targetLineText: allLines[targetLine - 1] || '',
      snippet: scrubSecrets(snippetLines.join('\n'))
    };
  } catch (err) {
    return null;
  }
}

function resolveImportPath(importTarget, sourceFileDir, rootDir) {
  // Relative imports only (e.g. ./services/aiProvider)
  if (!importTarget.startsWith('.')) {
    return null;
  }

  const baseResolved = path.resolve(sourceFileDir, importTarget);
  const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.py'];

  for (const ext of extensions) {
    const candidate = baseResolved + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && isSafePath(candidate, rootDir)) {
      return candidate;
    }
  }

  // Check index file inside directory
  for (const ext of ['.js', '.ts', '.mjs']) {
    const candidate = path.join(baseResolved, `index${ext}`);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && isSafePath(candidate, rootDir)) {
      return candidate;
    }
  }

  return null;
}

export function backtrackFailureChain(parsedTrace, rootDir = process.cwd(), maxHops = 3) {
  if (!parsedTrace || !parsedTrace.crashSite) {
    return null;
  }

  const inspectedFiles = new Set();
  const fileChain = [];

  // Case A: The stack trace itself contains multiple project frames
  // In V8/Python stack traces, frame 0 is the crash site, frame 1 is its caller, etc.
  const frames = parsedTrace.frames.slice(0, maxHops);

  if (frames.length > 1) {
    // We have a direct call stack cascade
    // Crash site is frame 0
    // Origin is the oldest frame in the trace (frames[frames.length - 1])
    // Propagation are intermediate frames
    for (let idx = 0; idx < frames.length; idx++) {
      const frame = frames[idx];
      inspectedFiles.add(frame.relativePath);

      const fileData = readSafeFileLines(frame.absolutePath, frame.lineNumber);
      if (!fileData) continue;

      let role = 'Propagation';
      if (idx === 0) {
        role = 'Crash Site';
      } else if (idx === frames.length - 1) {
        role = 'Origin';
      }

      fileChain.push({
        role,
        file_path: frame.relativePath,
        line_number: frame.lineNumber,
        function_name: frame.functionName,
        snippet: fileData.snippet,
        target_line_text: fileData.targetLineText
      });
    }

    // Sort logically from Origin -> Propagation -> Crash Site for the final report
    fileChain.sort((a, b) => {
      const order = { Origin: 1, Propagation: 2, 'Crash Site': 3 };
      return (order[a.role] || 9) - (order[b.role] || 9);
    });

    return {
      files_inspected_count: inspectedFiles.size,
      chain: fileChain
    };
  }

  // Case B: Single crash site frame. Follow local imports upwards to locate dependencies
  const crashSite = parsedTrace.crashSite;
  inspectedFiles.add(crashSite.relativePath);

  const crashData = readSafeFileLines(crashSite.absolutePath, crashSite.lineNumber);
  if (!crashData) {
    return null;
  }

  fileChain.push({
    role: 'Crash Site',
    file_path: crashSite.relativePath,
    line_number: crashSite.lineNumber,
    function_name: crashSite.functionName,
    snippet: crashData.snippet,
    target_line_text: crashData.targetLineText
  });

  // Search for imports in crash site snippet or file
  let currentFileDir = path.dirname(crashSite.absolutePath);
  let currentSnippet = crashData.snippet;
  let hops = 1;

  while (hops < maxHops) {
    const importMatches = [...currentSnippet.matchAll(IMPORT_REQUIRE_REGEX)];
    let nextHopFile = null;

    for (const match of importMatches) {
      const target = match[1] || match[2] || match[3];
      if (target) {
        const resolved = resolveImportPath(target, currentFileDir, rootDir);
        const rel = resolved ? toRelativeSafePath(resolved, rootDir) : null;
        if (resolved && !inspectedFiles.has(rel)) {
          nextHopFile = { resolved, rel };
          break;
        }
      }
    }

    if (!nextHopFile) break;

    inspectedFiles.add(nextHopFile.rel);
    const hopData = readSafeFileLines(nextHopFile.resolved, 1, 15);
    if (hopData) {
      fileChain.unshift({
        role: hops === 1 ? 'Origin' : 'Propagation',
        file_path: nextHopFile.rel,
        line_number: 1,
        function_name: 'importedModule',
        snippet: hopData.snippet,
        target_line_text: hopData.targetLineText
      });
      currentFileDir = path.dirname(nextHopFile.resolved);
      currentSnippet = hopData.snippet;
    }

    hops++;
  }

  return {
    files_inspected_count: inspectedFiles.size,
    chain: fileChain
  };
}
