FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx/nginx-unprivileged:1.31.8 AS runtime

USER root

COPY deploy/prod/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/prod/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/prod/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY deploy/prod/nginx/entrypoint.sh /entrypoint.sh

COPY --from=build --chown=nginx:nginx /app/dist /usr/share/nginx/html

RUN chmod 755 /entrypoint.sh \
    && mkdir -p /tmp/proxy_temp /tmp/client_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
    && nginx -t

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

ENTRYPOINT ["/entrypoint.sh"]
