const NodeEnvironment = require('jest-environment-node').TestEnvironment;
const cleanupE2eTenants = require('./e2e-cleanup.cjs');

/**
 * Fronteira de isolamento de cada arquivo E2E.
 *
 * A fila é global por definição. Portanto um `worker.tick()` manual da suíte B
 * pode reivindicar o job pendente deixado pela suíte A, mesmo com maxWorkers 1.
 * Limpar depois dos hooks (app/worker/Prisma já fechados) impede essa
 * dependência sem inventar uma fila diferente da produção.
 */
module.exports = class OrbitE2eEnvironment extends NodeEnvironment {
  async setup() {
    await cleanupE2eTenants();
    await super.setup();
    /** Cada suíte controla o worker explicitamente por `tick()`. */
    this.global.process.env.JOBS_WORKER_ENABLED = 'false';
  }

  async teardown() {
    await super.teardown();
    await cleanupE2eTenants();
  }
};
