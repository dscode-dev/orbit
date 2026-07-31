/**
 * Ponto único de acesso aos tipos da aplicação.
 *
 * - `./contracts` é gerado a partir de `backend/src/contracts` (npm run contracts:sync).
 *   Nunca redeclare aqui um tipo que já exista no backend.
 * - `./api` e `./session` cobrem apenas o transporte HTTP e a sessão do BFF.
 */
export * from "./contracts";
export * from "./api";
export * from "./session";
