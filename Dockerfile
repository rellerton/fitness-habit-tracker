# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app

# Prisma needs openssl on alpine
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Ensure prisma client + next build
RUN npx prisma generate
RUN npm run build

# ---- run ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

# Copy build output + deps
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma

# entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

CMD ["/app/docker-entrypoint.sh"]
