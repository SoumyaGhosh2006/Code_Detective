import test from 'node:test';
import assert from 'node:assert/strict';
import { stripCodeSyntax, sanitizeAutopsyPayload } from '../src/agent/validator.js';

test('stripCodeSyntax aggressively removes code fences, syntax operators, and assignments', () => {
  const dirty = `
\`\`\`javascript
const timeout = parseInt(env, 10);
return timeout;
\`\`\`
To fix this, write: const x = 5; and function solveProblem() { return true; };
`;

  const cleaned = stripCodeSyntax(dirty);

  // Must not have markdown code fences
  assert.equal(cleaned.includes('```'), false, 'Must not contain markdown backticks');
  // Must not have syntax keywords
  assert.equal(cleaned.includes('const timeout ='), false, 'Must not contain const assignment');
  assert.equal(cleaned.includes('function solveProblem()'), false, 'Must not contain function signature');
  assert.equal(cleaned.includes(';'), false, 'Must not contain semicolons');
  assert.equal(cleaned.includes('{'), false, 'Must not contain opening braces');
  assert.equal(cleaned.includes('}'), false, 'Must not contain closing braces');
});

test('sanitizeAutopsyPayload normalizes payload and enforces plain English', () => {
  const mockRawPayload = JSON.stringify({
    files_inspected_count: 3,
    corrupted_files: [
      { role: 'Origin', file_path: 'backend\\utils\\envParser.js', line_number: 19 }
    ],
    error_chain: [
      {
        step_number: 1,
        file_path: 'backend\\utils\\envParser.js',
        line_number: 19,
        what_went_wrong: 'const val = env; ```val = undefined;```'
      }
    ],
    step_by_step_resolution: [
      {
        order: 1,
        target_file: 'backend\\utils\\envParser.js',
        target_line: 19,
        action_instruction: 'Ensure you write `return parseInt(x, 10);` with fallback.'
      }
    ]
  });

  const sanitized = sanitizeAutopsyPayload(mockRawPayload);

  assert.equal(sanitized.files_inspected_count, 3);
  assert.equal(sanitized.corrupted_files[0].file_path, 'backend/utils/envParser.js');
  assert.equal(sanitized.error_chain[0].what_went_wrong.includes('```'), false);
  assert.equal(sanitized.step_by_step_resolution[0].action_instruction.includes(';'), false);
});
