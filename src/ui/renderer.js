import { colors, box } from './boxStyles.js';

function wrap(text, width) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function renderAutopsyReport(payload, width = 80) {
  const innerWidth = width - 4; // between left and right borders + spaces
  const out = [];

  const topTitle = ' 👻 GHOST IN THE MACHINE: AUTOPSY REPORT ';
  const totalDashes = width - 2 - topTitle.length;
  const leftDashes = Math.floor(totalDashes / 2);
  const rightDashes = totalDashes - leftDashes;

  // Header line
  out.push(
    `${colors.cyan}${box.topLeft}${box.horizontal.repeat(leftDashes)}${colors.bold}${colors.white}${topTitle}${colors.reset}${colors.cyan}${box.horizontal.repeat(rightDashes)}${box.topRight}${colors.reset}`
  );

  function line(content = '') {
    const rawLen = stripAnsi(content).length;
    const padding = Math.max(0, innerWidth - rawLen);
    out.push(
      `${colors.cyan}${box.vertical}${colors.reset} ${content}${' '.repeat(padding)} ${colors.cyan}${box.vertical}${colors.reset}`
    );
  }

  function blank() {
    line('');
  }

  blank();

  // 1. Investigation Trail
  const inspectedCount = payload.files_inspected_count || (payload.corrupted_files ? payload.corrupted_files.length : 1);
  const dirCount = new Set((payload.corrupted_files || []).map(f => (f.file_path.includes('/') ? f.file_path.split('/')[0] : 'root'))).size;
  line(`${colors.bold}${colors.cyan}🔍 AGENT INVESTIGATION TRAIL${colors.reset}`);
  line(`  Inspected ${inspectedCount} files across ${dirCount || 1} directories to trace the failure chain.`);

  blank();

  // 2. Corrupted / Faulty Files Detected
  const corrupted = payload.corrupted_files || [];
  line(`${colors.bold}${colors.yellow}⚠️ CORRUPTED / FAULTY FILES DETECTED (${corrupted.length} Files in Chain)${colors.reset}`);
  for (const f of corrupted) {
    const roleTag = `[${f.role}]`.padEnd(15);
    const lineStr = `(Line ${f.line_number})`;
    line(`  • ${colors.magenta}${roleTag}${colors.reset} ${f.file_path.padEnd(35)} ${colors.gray}${lineStr}${colors.reset}`);
  }

  blank();

  // 3. Chain of Errors (How the failure cascaded)
  line(`${colors.bold}${colors.cyan}🔗 CHAIN OF ERRORS (How the failure cascaded)${colors.reset}`);
  const chain = payload.error_chain || [];
  chain.forEach((step, idx) => {
    line(`  ${step.step_number || (idx + 1)}. ${colors.bold}${step.file_path}${colors.reset} ${colors.gray}(Line ${step.line_number})${colors.reset}`);
    const wrappedDesc = wrap(step.what_went_wrong, innerWidth - 7);
    wrappedDesc.forEach((wLine, wIdx) => {
      const prefix = wIdx === 0 ? '     └─ ' : '        ';
      line(`${prefix}${wLine}`);
    });
  });

  blank();

  // 4. Step-by-Step Debugging Plan (Ponytail Minimalist Guidance)
  line(`${colors.bold}${colors.green}🛠️ STEP-BY-STEP DEBUGGING PLAN (Solve in this exact order)${colors.reset}`);
  blank();

  const steps = payload.step_by_step_resolution || [];
  steps.forEach((step, idx) => {
    line(`  ${colors.bold}${colors.yellow}STEP ${step.order || (idx + 1)}:${colors.reset} Solve \`${step.target_file}\` (Line ${step.target_line})`);
    const wrappedFix = wrap(step.action_instruction, innerWidth - 6);
    wrappedFix.forEach((wLine, wIdx) => {
      const prefix = wIdx === 0 ? '  • What to fix: ' : '    ';
      line(`${prefix}${wLine}`);
    });
    if (idx < steps.length - 1) {
      blank();
    }
  });

  blank();

  // Footer line
  out.push(
    `${colors.cyan}${box.bottomLeft}${box.horizontal.repeat(width - 2)}${box.bottomRight}${colors.reset}`
  );

  return out.join('\n');
}
