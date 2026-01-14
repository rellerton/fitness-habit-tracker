ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest
FROM ${BUILD_FROM}

WORKDIR /app

# Install runtime deps
RUN apk add --no-cache nodejs npm nginx openssl bash

# Copy app source into image
COPY . /app

# Install deps + build
RUN npm ci
RUN npx prisma generate
RUN npm run build

# Nginx config + run script
COPY ha-addon/fitness-habit-tracker/nginx.conf /etc/nginx/http.d/default.conf
COPY ha-addon/fitness-habit-tracker/run.sh /run.sh
RUN chmod a+x /run.sh

EXPOSE 3000
CMD ["/run.sh"]
