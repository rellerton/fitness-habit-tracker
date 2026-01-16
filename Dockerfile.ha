ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

WORKDIR /app

# HA base uses s6-overlay. We'll run services via /etc/services.d
RUN apk add --no-cache nodejs npm nginx openssl bash

# Copy the full app (repo root is the build context in GitHub Actions)
COPY . /app

# Install + build
RUN npm ci
RUN npx prisma generate
ENV NEXT_PUBLIC_ASSET_PREFIX=.
RUN npm run build

# Nginx config (for ingress path)
COPY ha-addon/fitness-habit-tracker/nginx.conf /etc/nginx/http.d/default.conf

# s6 services (these are what actually start nginx + next)
COPY ha-addon/fitness-habit-tracker/services.d /etc/services.d
RUN chmod a+x /etc/services.d/*/run

ENV NODE_ENV=production
EXPOSE 3000
