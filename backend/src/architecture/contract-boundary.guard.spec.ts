import { resolve } from 'node:path';
import { validateContractImports } from './contract-boundary.guard';

describe('synchronized contract architecture guard', () => {
  const contract = resolve('/fixture/contracts/public.ts');
  const otherContract = resolve('/fixture/contracts/literals.ts');
  const allowed = new Set([contract, otherContract]);

  it('accepts imports between synchronized contracts', () => {
    expect(
      validateContractImports(
        contract,
        "import type { Status } from './literals';",
        allowed,
      ),
    ).toEqual([]);
  });

  it.each([
    "import type { Prisma } from '@prisma/client';",
    "export type { Internal } from '../services/internal.service';",
  ])('rejects implementation/runtime import: %s', (source) => {
    const [violation] = validateContractImports(contract, source, allowed);
    expect(violation).toMatchObject({ file: contract });
    expect(violation?.reason).toBeTruthy();
  });
});
