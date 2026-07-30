# Orbit — Design System (Next.js 15)

Projeto exportado da stack Lovable (TanStack Start) para **Next.js 15 (App Router)**,
React 19 e Tailwind CSS v4. Roda de forma totalmente autônoma.

```
app/
  layout.tsx      # layout raiz (server) + fontes + metadata
  providers.tsx   # providers client (Tooltip, Toaster)
  page.tsx        # showcase completo do design system
  not-found.tsx   # 404
  error.tsx       # error boundary
  globals.css     # tokens Tailwind v4 (light padrão, .dark opcional)
src/
  components/     # brand, layout, navigation, feedback, charts, ui
  hooks/
  lib/            # utils + design tokens tipados
public/
  orbit_logo.png
```

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
