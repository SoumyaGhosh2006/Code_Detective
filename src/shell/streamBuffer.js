import { EventEmitter } from 'node:events';

const FATAL_ERROR_PATTERNS = [
  /\b(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError):\s/i,
  /\bUnhandledPromiseRejection\b/i,
  /\bCannot find module\b/i,
  /Traceback \(most recent call last\):/i,
  /\bpanic:\s/i,
  /\bfatal error:\s/i,
  /\bSegmentation fault\b/i
];

export class StreamBuffer extends EventEmitter {
  constructor(maxLines = 250, debounceMs = 500) {
    super();
    this.maxLines = maxLines;
    this.debounceMs = debounceMs;
    this.lines = [];
    this.debounceTimer = null;
    this.hasPendingCrash = false;
  }

  write(chunk) {
    const text = chunk.toString();
    const splitLines = text.split(/\r?\n/);

    for (const l of splitLines) {
      if (this.lines.length >= this.maxLines) {
        this.lines.shift();
      }
      this.lines.push(l);
    }

    // Check for fatal crash signatures
    for (const pattern of FATAL_ERROR_PATTERNS) {
      if (pattern.test(text)) {
        this.scheduleDebouncedCrash();
        break;
      }
    }
  }

  scheduleDebouncedCrash() {
    this.hasPendingCrash = true;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      if (this.hasPendingCrash) {
        this.hasPendingCrash = false;
        this.emit('debounced-crash', this.getBufferText());
      }
    }, this.debounceMs);
  }

  cancelDebouncedCrash() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.hasPendingCrash = false;
  }

  getBufferText() {
    return this.lines.join('\n');
  }

  clear() {
    this.lines = [];
    this.cancelDebouncedCrash();
  }
}
