// Project health check, used both manually and by the Claude Code Stop hook.
// Runs lint, the card-matching self-tests, and a production build.
// Exit 0 = all good; exit 2 = failures (printed to stderr so the hook can
// block the stop and report what broke).
import { execSync } from 'node:child_process';

const steps = [
  ['lint', 'npx eslint .'],
  ['matching self-tests', 'node scripts/test-matching.mjs'],
  ['build', 'npx vite build'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
for (const [label, cmd] of steps) {
  // OneDrive holds locks on freshly-synced files (dist/sprites), which makes
  // vite's empty-out-dir step fail with transient EPERM — retry those.
  let lastOut = '';
  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
      ok = true;
    } catch (err) {
      lastOut = `${err.stdout ?? ''}\n${err.stderr ?? ''}`.trim().slice(0, 2500);
      if (attempt < 3) await sleep(5000);
    }
  }
  if (ok) console.log(`[check] ${label}: OK`);
  else failures.push(`--- ${label} FAILED (3 attempts) ---\n${lastOut}`);
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(2);
}
console.log('[check] all checks passed');
