import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseStackTrace } from '../src/agent/traceParser.js';
import { backtrackFailureChain } from '../src/agent/symbolFollower.js';

test('backtrackFailureChain traverses project files to locate error origin and crash site', () => {
  const rootDir = path.resolve('test/fixtures/broken-app');
  const mockBuffer = `
TypeError: Cannot read properties of null (reading 'request')
    at handleGenerateRequest (routes/generate.route.js:7:17)
    at server.js:5:1
`;

  const parsed = parseStackTrace(mockBuffer, rootDir);
  assert.ok(parsed, 'Stack trace should be parsed');

  const failureChain = backtrackFailureChain(parsed, rootDir, 3);
  assert.ok(failureChain, 'Failure chain should not be null');
  assert.ok(failureChain.files_inspected_count >= 2, 'Should inspect at least 2 files');
  assert.ok(failureChain.chain.length >= 2, 'Should have at least 2 links in the chain');

  // Verify roles
  const roles = failureChain.chain.map(f => f.role);
  assert.ok(roles.includes('Crash Site'), 'Must have a Crash Site');
  assert.ok(roles.includes('Origin') || roles.includes('Propagation'), 'Must have upstream Origin or Propagation');

  // Verify file snippets are populated
  for (const item of failureChain.chain) {
    assert.ok(item.snippet, `File ${item.file_path} must have code snippet context`);
    assert.ok(item.line_number > 0, `Line number must be positive for ${item.file_path}`);
  }
});
