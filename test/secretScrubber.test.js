import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubSecrets } from '../src/security/secretScrubber.js';
import { isSafePath } from '../src/security/pathGuard.js';

test('scrubSecrets redacts API keys, JWTs, tokens, and database passwords', () => {
  const dirty = `
const apiKey = "sk-abcdef1234567890abcdef1234567890";
const githubToken = "ghp_1234567890abcdefghijklmnopqrstuv";
const awsKey = "AKIA1234567890ABCDEF";
const authHeader = "Bearer eyJhToken1234567890.eyJhBody1234567890.signaturePart1234567890";
const conn = "postgres://admin_user:superSecretPassword99@localhost:5432/production_db";
`;

  const clean = scrubSecrets(dirty);

  assert.equal(clean.includes('sk-abcdef1234567890abcdef1234567890'), false);
  assert.equal(clean.includes('ghp_1234567890abcdefghijklmnopqrstuv'), false);
  assert.equal(clean.includes('AKIA1234567890ABCDEF'), false);
  assert.equal(clean.includes('superSecretPassword99'), false);
  assert.equal(clean.includes('signaturePart1234567890'), false);

  assert.ok(clean.includes('[REDACTED_API_KEY]'));
  assert.ok(clean.includes('[REDACTED_GITHUB_TOKEN]'));
  assert.ok(clean.includes('[REDACTED_AWS_KEY]'));
  assert.ok(clean.includes('[REDACTED_CREDENTIALS]'));
});

test('pathGuard prevents reading sensitive files or directory traversal', () => {
  const root = 'C:/my-project';
  assert.equal(isSafePath('C:/my-project/src/index.js', root), true);
  assert.equal(isSafePath('C:/my-project/.env', root), false);
  assert.equal(isSafePath('C:/my-project/.git/config', root), false);
  assert.equal(isSafePath('C:/other-dir/secret.txt', root), false);
  assert.equal(isSafePath('../../windows/system32', root), false);
});
