import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStackTrace } from '../src/agent/traceParser.js';

test('parseStackTrace extracts crash site and error type from Node.js V8 stack trace', () => {
  const mockBuffer = `
[Server] Starting broken app fixture...
TypeError: Cannot read properties of null (reading 'request')
    at handleGenerateRequest (test/fixtures/broken-app/routes/generate.route.js:7:17)
    at test/fixtures/broken-app/server.js:5:1
    at ModuleJob.run (node:internal/modules/esm/module_job:234:12)
    at async ModuleLoader.import (node:internal/modules/esm/loader:473:24)
`;

  const parsed = parseStackTrace(mockBuffer, process.cwd());

  assert.ok(parsed, 'Parsed trace should not be null');
  assert.equal(parsed.errorType, 'TypeError');
  assert.equal(parsed.errorMessage, "Cannot read properties of null (reading 'request')");
  assert.ok(parsed.crashSite, 'Crash site should be identified');
  assert.equal(parsed.crashSite.lineNumber, 7);
  assert.ok(parsed.crashSite.relativePath.includes('generate.route.js'));

  // Ensure internal runtime frames were filtered out
  const hasNodeInternal = parsed.frames.some(f => f.rawPath.includes('node:internal'));
  assert.equal(hasNodeInternal, false, 'Internal frames must be filtered out');
});

test('parseStackTrace parses Python tracebacks correctly', () => {
  const pyBuffer = `
Traceback (most recent call last):
  File "backend/services/ai.py", line 45, in call_model
    response = client.generate()
  File "backend/routes/main.py", line 12, in index
    res = call_model()
ZeroDivisionError: division by zero
`;

  const parsed = parseStackTrace(pyBuffer, process.cwd());

  assert.ok(parsed, 'Python trace should not be null');
  assert.equal(parsed.errorType, 'ZeroDivisionError');
  assert.equal(parsed.errorMessage, 'division by zero');
  assert.equal(parsed.crashSite.lineNumber, 45);
});
