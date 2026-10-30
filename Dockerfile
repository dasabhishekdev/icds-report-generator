# syntax=docker/dockerfile:1.7
# Targets: `web` (nginx serving the SPA and proxying /api) and `api` (Node + MongoDB driver).

FROM node:22-alpine AS build
ARG GIT_SHA=unknown
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && npm run build && printf '%s\n' "${GIT_SHA}" > dist/version.txt

FROM node:22-alpine AS api
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="icds-report-generator-api" \
      org.opencontainers.image.revision="${GIT_SHA}"
ENV NODE_ENV=production PORT=4000
WORKDIR /app
# The server is a single esbuild bundle, so the image needs no node_modules.
COPY --from=build /app/dist-server/index.cjs ./index.cjs
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.cjs"]

FROM nginxinc/nginx-unprivileged:1.27-alpine AS web
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="icds-report-generator-web" \
      org.opencontainers.image.revision="${GIT_SHA}"
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
