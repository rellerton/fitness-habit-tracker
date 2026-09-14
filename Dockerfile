# ---- deps ----
FROM node:24-alpine AS deps
WORKDIR /app

# Prisma needs openssl on alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

# ---- build ----
FROM node:24-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate the Prisma client as part of the application build.
ENV NEXT_PUBLIC_ASSET_PREFIX=.
RUN npm run build

# ---- production dependencies ----
FROM node:24-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npx prisma generate \
  && rm -rf /root/.npm

# ---- run ----
FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Runtime commands invoke Node entry points directly. npm/npx are unnecessary
# in the final image and would add avoidable packages and vulnerabilities.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy build output + deps
COPY --from=build /app/package.json ./package.json
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma

# entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh \
    && chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["/app/docker-entrypoint.sh"]
