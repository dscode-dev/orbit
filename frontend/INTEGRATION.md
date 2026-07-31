# Integração Next.js + NestJS

O navegador conversa com os Route Handlers do Next.js. Access e refresh tokens
ficam em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em produção; eles não são
expostos ao JavaScript da aplicação.

Configure `ORBIT_API_URL` no frontend com a URL interna do NestJS. Em
desenvolvimento, o padrão é `http://localhost:3001`.

O middleware protege `/dashboard`, rotaciona o refresh token e redireciona
usuários autenticados para fora de `/login` e `/cadastro`.

> A arquitetura completa da camada de comunicação (BFF, cliente HTTP, sessão,
> contexto multi-tenant, TanStack Query e como novos módulos consomem a API)
> está em [`docs/frontend-core.md`](./docs/frontend-core.md).

O cadastro cria, de forma transacional:

- usuário e credencial;
- organização;
- unidade principal;
- papel `OWNER`;
- memberships da organização e da unidade.

A migration `20260730230000_seed_starter_plan` fornece o plano de onboarding
necessário para instalações novas. Ela deve ser aplicada pelo responsável pelo
ambiente junto às demais migrations.
