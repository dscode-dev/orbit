import { resolve } from 'node:path';
import { validateSynchronizedContracts } from '../src/architecture/contract-boundary.guard';

const violations = validateSynchronizedContracts(resolve(process.cwd()));
if (violations.length) {
  for (const violation of violations) {
    console.error(
      `[contracts:guard] ${violation.file}: import "${violation.imported}" forbidden — ${violation.reason}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log('[contracts:guard] synchronized boundary valid');
}
