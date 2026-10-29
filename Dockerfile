# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build
ARG GIT_SHA=unknown
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm test && npm run build && printf '%s\n' "${GIT_SHA}" > dist/version.txt

FROM nginxinc/nginx-unprivileged:1.27-alpine
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.title="icds-report-generator" \
      org.opencontainers.image.revision="${GIT_SHA}"
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
