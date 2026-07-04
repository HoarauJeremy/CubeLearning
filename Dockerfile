# syntax=docker/dockerfile:1

# ---------- Base : Node + pnpm ----------
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---------- Dépendances (couche cachée tant que le lockfile ne change pas) ----------
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------- Cible DEV : Vite + HMR ----------
# docker compose up  (voir docker-compose.yml, target: dev)
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]

# ---------- Build de production ----------
FROM deps AS build
COPY . .
RUN pnpm build

# ---------- Cible PROD : nginx qui sert le statique ----------
FROM nginx:1.30-alpine-slim AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1