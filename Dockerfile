# Imagem de produção: Next.js + Chromium para renderizar HTML → PNG.
FROM node:22-bookworm-slim AS base

# Chromium + fontes (emoji colorido e fallback para caracteres fora do Inter)
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-noto-color-emoji fonts-noto-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
EXPOSE 3000
CMD ["npx", "next", "start"]
