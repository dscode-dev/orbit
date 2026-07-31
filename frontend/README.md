# Orbit — Design System (Next.js 15)

Projeto exportado da stack Lovable (TanStack Start) para **Next.js 15 (App Router)**,
React 19 e Tailwind CSS v4. Roda de forma totalmente autônoma.

```
app/
  layout.tsx      # layout raiz (server) + fontes + metadata
  providers.tsx   # providers client (Frontend Core + Tooltip, Toaster)
  page.tsx        # showcase completo do design system
  not-found.tsx   # 404
  error.tsx       # error boundary
  globals.css     # tokens Tailwind v4 (light padrão, .dark opcional)
  api/            # BFF: /api/auth/* e proxy /api/orbit/**
proxy.ts          # middleware de autenticação
src/
  components/     # brand, layout, navigation, feedback, charts, ui
  api/            # cliente HTTP do browser (→ BFF)
  server/         # cliente do NestJS, sessão e handlers do BFF
  providers/      # TanStack Query, sessão e contexto multi-tenant
  hooks/          # use-mobile + hooks/api (query, mutation, upload…)
  services/       # serviços por recurso
  types/          # contratos sincronizados do backend + transporte
  lib/            # utils, design tokens tipados, env, erros, retry, rotas
  utils/          # utilitários HTTP puros
public/
  orbit_logo.png
```

A camada de comunicação com o backend está documentada em
[`docs/frontend-core.md`](./docs/frontend-core.md).

## Executar localmente

```bash
npm install
npm run dev     # http://localhost:3000
```

## Build de produção

```bash
npm run build && npm start
```

## Temas

O tema **light** (branco em primeiro plano) é o padrão em `:root`.
Para ativar o tema escuro, adicione `className="dark"` no `<html>` de `app/layout.tsx`.

## Notas de conversão

- `@tanstack/react-router` → `next/link` (`to` → `href`).
- Componentes interativos recebem a diretiva `"use client"`.
- O logo é servido de `/public/orbit_logo.png`.
