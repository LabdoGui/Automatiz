# syntax=docker/dockerfile:1
# Imagem de produção do VIVA (Next.js standalone).
#   docker compose up --build        → banco + migrações/seed + app em http://localhost:3000

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma/schema.prisma prisma/schema.prisma
# postinstall roda "prisma generate" (não precisa de banco)
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && NEXT_OUTPUT=standalone npm run build
# Esta etapa também serve para migrações e seed (tem o Prisma CLI e o tsx).

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 viva && useradd --system --uid 1001 --gid viva viva
COPY --from=builder --chown=viva:viva /app/.next/standalone ./
COPY --from=builder --chown=viva:viva /app/.next/static ./.next/static
COPY --from=builder --chown=viva:viva /app/public ./public
USER viva
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
