# syntax=docker/dockerfile:1

# ---------- Base ----------
FROM node:24-alpine AS base
WORKDIR /app

# ---------- Dépendances (couche cachée tant que le lockfile ne change pas) ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm,target=/root/.npm \
    npm ci

# ---------- Cible DEV : Vite + HMR ----------
# docker compose up  (voir docker-compose.yml, target: dev)
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- Build de production ----------
FROM deps AS build
COPY . .
RUN npm run build

# ---------- Cible PROD : nginx qui sert le statique ----------
FROM nginx:1.30-alpine-slim AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ > /dev/null || exit 1