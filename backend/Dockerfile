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
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 orbit \
  && useradd --system --uid 1001 --gid orbit orbit \
  && mkdir -p /app/storage/operations \
  && chown -R orbit:orbit /app

COPY --from=builder --chown=orbit:orbit /app/node_modules ./node_modules
COPY --from=builder --chown=orbit:orbit /app/dist ./dist
COPY --from=builder --chown=orbit:orbit /app/package.json ./package.json

USER orbit
EXPOSE 3001

CMD ["node", "dist/src/main.js"]
