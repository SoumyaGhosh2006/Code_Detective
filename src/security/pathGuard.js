import path from 'node:path';

const BLOCKED_PATTERNS = [
  /^\.env(\..+)?$/i,
  /^\.git([\\/].+)?$/i,
  /id_rsa/i,
  /\.pem$/i,
  /\.key$/i,
  /node_modules([\\/].+)?$/i,
  /\.venv([\\/].+)?$/i
];

export function isSafePath(targetPath, rootDir = process.cwd()) {
  if (!targetPath || typeof targetPath !== 'string') return false;

  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(rootDir, targetPath);

  const normalizedRoot = path.resolve(rootDir);

  // Must reside inside rootDir
  if (!resolved.startsWith(normalizedRoot)) {
    return false;
  }

  const relative = path.relative(normalizedRoot, resolved);

  // Check against sensitive file patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(relative)) {
      return false;
    }
  }

  return true;
}

export function toRelativeSafePath(targetPath, rootDir = process.cwd()) {
  const resolved = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(rootDir, targetPath);
  return path.relative(rootDir, resolved).replace(/\\/g, '/');
}
