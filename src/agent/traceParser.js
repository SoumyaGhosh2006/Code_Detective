import path from 'node:path';
import { isSafePath, toRelativeSafePath } from '../security/pathGuard.js';

const ERROR_HEADER_REGEX = /(?:^|\n)(?:([A-Za-z0-9_.]*(?:Error|Exception|Rejection|Panic|Fault)):\s*(.*)|panic:\s*(.*)|(Traceback \(most recent call last\):))/m;

// Matches Node.js / V8 stack frames:
//   at Object.fn (/path/to/file.js:10:5)
//   at /path/to/file.js:10:5
//   at async fn (C:\path\to\file.js:10:5)
const NODE_FRAME_REGEX = /at\s+(?:(?:async\s+)?([^\s(]+)\s+\((.+?):(\d+):(\d+)\)|(.+?):(\d+):(\d+))/;

// Matches Python stack frames:
//   File "path/to/file.py", line 10, in fn
const PYTHON_FRAME_REGEX = /File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+([^\s\r\n]+))?/;

// Matches generic compiler/linter error lines:
//   path/to/file.ts:10:5: error: ...
//   path/to/file.js(10,5): error ...
const GENERIC_FRAME_REGEX = /([A-Za-z0-9_.\-\/\\]+\.[a-zA-Z0-9]+)[:(](\d+)(?:[,:](\d+)\)?)?/;

function isInternalLibrary(filePath) {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.includes('node_modules/') ||
    normalized.includes('node:internal/') ||
    normalized.includes('site-packages/') ||
    normalized.includes('.venv/') ||
    normalized.includes('/<anonymous>') ||
    normalized.startsWith('internal/')
  );
}

export function parseStackTrace(terminalBuffer, rootDir = process.cwd()) {
  if (!terminalBuffer || typeof terminalBuffer !== 'string') {
    return null;
  }

  // 1. Detect error header
  let errorType = 'RuntimeError';
  let errorMessage = 'An unhandled exception crashed the process.';

  const headerMatch = terminalBuffer.match(ERROR_HEADER_REGEX);
  if (headerMatch) {
    if (headerMatch[1]) {
      errorType = headerMatch[1];
      errorMessage = (headerMatch[2] || '').trim();
    } else if (headerMatch[3]) {
      errorType = 'Panic';
      errorMessage = headerMatch[3].trim();
    } else if (headerMatch[4]) {
      errorType = 'PythonTraceback';
      // Look at the last line of the traceback for the actual exception
      const lines = terminalBuffer.trim().split('\n');
      const lastLine = lines[lines.length - 1];
      const pyExcMatch = lastLine.match(/^([A-Za-z_][A-Za-z0-9_]*Error|Exception):\s*(.*)/);
      if (pyExcMatch) {
        errorType = pyExcMatch[1];
        errorMessage = pyExcMatch[2].trim();
      }
    }
  }

  // 2. Scan lines for stack frames
  const lines = terminalBuffer.split('\n');
  const projectFrames = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check Node.js frame
    const nodeMatch = line.match(NODE_FRAME_REGEX);
    if (nodeMatch) {
      const fnName = nodeMatch[1] || 'anonymous';
      const rawPath = nodeMatch[2] || nodeMatch[5];
      const lineNum = parseInt(nodeMatch[3] || nodeMatch[6], 10);
      const colNum = parseInt(nodeMatch[4] || nodeMatch[7], 10);

      if (rawPath && !isInternalLibrary(rawPath)) {
        projectFrames.push({
          rawPath,
          functionName: fnName,
          lineNumber: lineNum,
          columnNumber: colNum
        });
      }
      continue;
    }

    // Check Python frame
    const pyMatch = line.match(PYTHON_FRAME_REGEX);
    if (pyMatch) {
      const rawPath = pyMatch[1];
      const lineNum = parseInt(pyMatch[2], 10);
      const fnName = pyMatch[3] || 'module';

      if (rawPath && !isInternalLibrary(rawPath)) {
        projectFrames.push({
          rawPath,
          functionName: fnName,
          lineNumber: lineNum,
          columnNumber: 1
        });
      }
      continue;
    }

    // Check Generic frame
    const genMatch = line.match(GENERIC_FRAME_REGEX);
    if (genMatch && !line.startsWith('at ') && !line.startsWith('File ')) {
      const rawPath = genMatch[1];
      const lineNum = parseInt(genMatch[2], 10);
      const colNum = genMatch[3] ? parseInt(genMatch[3], 10) : 1;

      if (rawPath && !isInternalLibrary(rawPath)) {
        // Confirm it looks like a code file
        if (/\.(js|jsx|ts|tsx|py|go|rs|c|cpp|php|rb|json)$/i.test(rawPath)) {
          projectFrames.push({
            rawPath,
            functionName: 'unknown',
            lineNumber: lineNum,
            columnNumber: colNum
          });
        }
      }
    }
  }

  if (projectFrames.length === 0) {
    return null;
  }

  // Deduplicate and resolve relative project paths
  const resolvedFrames = [];
  const seen = new Set();

  for (const frame of projectFrames) {
    const absPath = path.isAbsolute(frame.rawPath)
      ? path.resolve(frame.rawPath)
      : path.resolve(rootDir, frame.rawPath);

    const relPath = toRelativeSafePath(absPath, rootDir);
    const key = `${relPath}:${frame.lineNumber}`;

    if (!seen.has(key)) {
      seen.add(key);
      resolvedFrames.push({
        ...frame,
        absolutePath: absPath,
        relativePath: relPath
      });
    }
  }

  if (resolvedFrames.length === 0) {
    return null;
  }

  // The crash site is the first project frame
  const crashSite = resolvedFrames[0];

  return {
    errorType,
    errorMessage,
    crashSite,
    frames: resolvedFrames
  };
}
