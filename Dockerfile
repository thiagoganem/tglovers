# ---------------------------------------------------------------------------
# Frontend TGlovers — Next.js (saída standalone)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts || npm install --omit=dev

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .

# ATENÇÃO: `BACKEND_URL` é uma variável de BUILD, não de runtime. O Next resolve
# os `rewrites` durante o build e grava o destino no bundle standalone — definir
# essa variável só na execução não tem efeito nenhum.
ARG BACKEND_URL=http://127.0.0.1:8000
ENV BACKEND_URL=$BACKEND_URL
ARG STICKER_URL=http://127.0.0.1:8100
ENV STICKER_URL=$STICKER_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 10001 nodejs && adduser -S -u 10001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
