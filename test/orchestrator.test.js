import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PONYTAIL_RULES_PATH, loadPonytailRules, buildSystemPrompt } from '../src/agent/orchestrator.js';

test('ponytail-rules.txt is bundled and loaded directly into system prompt', () => {
  // 1. Verify file exists on disk
  assert.ok(fs.existsSync(PONYTAIL_RULES_PATH), 'ponytail-rules.txt must exist in src/agent/');

  // 2. Verify rules content
  const rules = loadPonytailRules();
  assert.ok(rules.length > 100, 'Ponytail rules must not be empty');
  assert.ok(rules.includes('smallest complete change'), 'Must contain smallest complete change section');
  assert.ok(rules.includes('Deletion beats addition') || rules.includes('deletion'), 'Must emphasize deletion over addition');

  // 3. Verify system prompt incorporates Ponytail and Zero-Code rules
  const prompt = buildSystemPrompt();
  assert.ok(prompt.includes('Ghost Autopsy'), 'System prompt must identify as Ghost Autopsy');
  assert.ok(prompt.includes('STRICT ZERO-CODE MANDATE'), 'System prompt must enforce Zero-Code mandate');
  assert.ok(prompt.includes(rules), 'System prompt must contain the loaded ponytail-rules.txt content');
});
