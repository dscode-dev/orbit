import { spawnSync } from 'node:child_process';

const runs = Number(process.argv[2] ?? 10);
const jest = new URL('../node_modules/jest/bin/jest.js', import.meta.url);
let failures = 0;

for (let run = 1; run <= runs; run += 1) {
  const startedAt = Date.now();
  const result = spawnSync(
    process.execPath,
    [
      jest.pathname,
      '--config',
      './test/jest-e2e.json',
      '--runInBand',
      '--watchman=false',
    ],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
  );
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const suites = output.match(/Test Suites:\s+([^\n]+)/)?.[1] ?? 'unknown';
  const tests = output.match(/Tests:\s+([^\n]+)/)?.[1] ?? 'unknown';
  const summary = {
    run,
    exitCode: result.status,
    durationMs: Date.now() - startedAt,
    suites,
    tests,
    expiredTransactions: (output.match(/expired transaction/gi) ?? []).length,
    crossTenantLeaks: (output.match(/cross-tenant leak/gi) ?? []).length,
    capabilityLeaks: (output.match(/capability leak/gi) ?? []).length,
    teardownTimeouts: (output.match(/timeout of 5000 ms for a hook/gi) ?? [])
      .length,
  };
  console.log(JSON.stringify(summary));

  if (result.status !== 0) {
    failures += 1;
    console.error(output);
  }
}

console.log(JSON.stringify({ runs, passed: runs - failures, failures }));
process.exitCode = failures === 0 ? 0 : 1;
