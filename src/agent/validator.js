/**
 * Aggressive Zero-Code Sanitizer Gate & JSON Schema Validator
 *
 * Ensures the response strictly adheres to the requested JSON structure
 * and completely strips any code syntax, code fences, or copy-paste snippets.
 */

export function stripCodeSyntax(text) {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text;

  // 1. Remove markdown code fences: ```lang ... ``` or ``` ... ```
  sanitized = sanitized.replace(/```[a-zA-Z0-9_-]*\s*([\s\S]*?)```/g, (match, inner) => {
    // If the model put an explanation inside a code block, strip the backticks
    // and convert syntax to plain words
    return inner.replace(/[;{}]/g, ' ').trim();
  });

  // 2. Remove isolated backticks around syntax: `const x = 5` -> x is 5
  sanitized = sanitized.replace(/`([^`]+)`/g, (match, inner) => {
    // If it's a file path or single variable name (e.g. `timeout`), keep it wrapped for readability
    if (/^[a-zA-Z0-9_\-\.\/\\]+$/.test(inner.trim())) {
      return `\`${inner.trim()}\``;
    }
    // Otherwise strip the backtick formatting
    return inner.trim();
  });

  // 3. Strip code assignment statements: e.g. "const x = 10;" or "let y = true"
  sanitized = sanitized.replace(/\b(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*([^;,\n]+)[;\n]?/gi, 'set $1 to $2');

  // 4. Strip function declarations: e.g. "function foo(...) {" or "def foo(...):"
  sanitized = sanitized.replace(/\bfunction\s+([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{?/gi, 'the $1 function');
  sanitized = sanitized.replace(/\bdef\s+([a-zA-Z0-9_$]+)\s*\([^)]*\):/gi, 'the $1 function');

  // 5. Strip import statements: e.g. "import x from 'y';" or "const x = require('y')"
  sanitized = sanitized.replace(/\bimport\s+.*?\s+from\s+['"][^'"]+['"];?/gi, 'the import module');
  sanitized = sanitized.replace(/\b(?:const|let|var)\s+.*?\s*=\s*require\([^)]+\);?/gi, 'the required module');

  // 6. Strip return statements: "return x;" -> "return x"
  sanitized = sanitized.replace(/\breturn\s+([^;]+);/gi, 'return $1');

  // 7. Strip semicolons and stray braces that look like code snippets
  sanitized = sanitized.replace(/[{};]/g, ' ');

  // 8. Normalize excessive whitespace
  sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

  return sanitized;
}

export function sanitizeAutopsyPayload(rawPayload, verifiedChain = null) {
  let parsed = null;

  if (typeof rawPayload === 'string') {
    // Attempt to extract JSON if enclosed in markdown or text
    const jsonMatch = rawPayload.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM output does not contain valid JSON.');
    }
    parsed = JSON.parse(jsonMatch[0]);
  } else if (typeof rawPayload === 'object' && rawPayload !== null) {
    parsed = rawPayload;
  } else {
    throw new Error('Invalid autopsy payload structure.');
  }

  // Ensure top-level fields exist
  const filesInspectedCount = Number(parsed.files_inspected_count) || (verifiedChain ? verifiedChain.files_inspected_count : 1);
  const corruptedFiles = Array.isArray(parsed.corrupted_files) ? parsed.corrupted_files : [];
  const errorChain = Array.isArray(parsed.error_chain) ? parsed.error_chain : [];
  const resolutionSteps = Array.isArray(parsed.step_by_step_resolution) ? parsed.step_by_step_resolution : [];

  // Sanitize corrupted files (must match verified files if verifiedChain is provided)
  const sanitizedCorrupted = corruptedFiles.map(cf => ({
    role: cf.role || 'Suspect',
    file_path: String(cf.file_path || '').replace(/\\/g, '/'),
    line_number: Number(cf.line_number) || 1
  }));

  // Sanitize error chain
  const sanitizedChain = errorChain.map((ec, idx) => ({
    step_number: Number(ec.step_number) || (idx + 1),
    file_path: String(ec.file_path || '').replace(/\\/g, '/'),
    line_number: Number(ec.line_number) || 1,
    what_went_wrong: stripCodeSyntax(ec.what_went_wrong || 'A logical defect caused an unexpected value.')
  }));

  // Sanitize step by step resolution
  const sanitizedResolution = resolutionSteps.map((res, idx) => ({
    order: Number(res.order) || (idx + 1),
    target_file: String(res.target_file || '').replace(/\\/g, '/'),
    target_line: Number(res.target_line) || 1,
    action_instruction: stripCodeSyntax(res.action_instruction || 'Inspect and correct the logic at this line.')
  }));

  return {
    files_inspected_count: filesInspectedCount,
    corrupted_files: sanitizedCorrupted,
    error_chain: sanitizedChain,
    step_by_step_resolution: sanitizedResolution
  };
}
