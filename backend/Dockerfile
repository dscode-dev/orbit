FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NODE_ENV=development

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

FROM builder AS migrator

ARG ORBIT_COMMIT_SHA=unknown
ARG ORBIT_BUILD_TIME=unknown
LABEL org.opencontainers.image.revision=$ORBIT_COMMIT_SHA \
  org.opencontainers.image.created=$ORBIT_BUILD_TIME \
  org.opencontainers.image.source="https://github.com/allbluelabs/orbit"
ENV ORBIT_COMMIT_SHA=$ORBIT_COMMIT_SHA
ENV ORBIT_BUILD_TIME=$ORBIT_BUILD_TIME

# Migrar, provisionar e reconciliar o catálogo obrigatório são o mesmo passo,
# nesta ordem.
#
# O provisionamento roda **depois** para que uma tabela criada pela migration
# recém-aplicada já receba os GRANTs do papel de runtime — sem passo manual
# depois do `docker compose up`. É idempotente: rodar de novo reconcilia.
USER node
CMD ["sh", "-c", "DATABASE_ROLE_BOOTSTRAP_ONLY=true node dist/src/scripts/provision-database-roles.js && ./node_modules/.bin/prisma migrate deploy && node dist/src/scripts/provision-database-roles.js && node dist/src/scripts/seed-plan-catalog.js"]

FROM builder AS production-dependencies

RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

ARG ORBIT_COMMIT_SHA=unknown
ARG ORBIT_BUILD_TIME=unknown
LABEL org.opencontainers.image.revision=$ORBIT_COMMIT_SHA \
  org.opencontainers.image.created=$ORBIT_BUILD_TIME \
  org.opencontainers.image.source="https://github.com/allbluelabs/orbit"

ENV NODE_ENV=production
ENV PORT=3001
ENV ORBIT_COMMIT_SHA=$ORBIT_COMMIT_SHA
ENV ORBIT_BUILD_TIME=$ORBIT_BUILD_TIME
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 orbit \
  && useradd --system --uid 1001 --gid orbit orbit \
  && mkdir -p /app/storage/operations \
  && mkdir -p /app/storage/documents \
  # Objetos do Storage Provider (PR-19). O diretório precisa existir na imagem
  # com a dona certa: um volume montado sobre caminho inexistente nasce do root,
  # e o processo, que roda como `orbit`, não consegue gravar.
  && mkdir -p /app/storage/objects \
  && chown -R orbit:orbit /app

COPY --from=production-dependencies --chown=orbit:orbit /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=orbit:orbit /app/dist ./dist
COPY --from=production-dependencies --chown=orbit:orbit /app/package.json ./package.json

USER orbit
EXPOSE 3001

CMD ["node", "dist/src/main.js"]
