# syntax=docker/dockerfile:1
# Imagem de produção do supabase-pwn (Next.js standalone).
# Node 22 LTS: estável e reprodutível entre macOS e Linux.

FROM node:22-alpine AS base

# --- deps: instala dependencias com lockfile ---
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# --- builder: gera o build standalone ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- runner: imagem final, usuario nao-root ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Escuta em todas as interfaces DENTRO do container; a restricao ao loopback
# do host e feita no mapeamento de porta (docker-compose: 127.0.0.1:3000:3000).
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
