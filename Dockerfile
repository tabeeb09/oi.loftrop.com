FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
EXPOSE 3000

# Install dependencies (this is where lightningcss native addon gets installed)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --include=optional

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

CMD ["node","server.js"]

# Dev image (optional)
FROM base AS dev
ENV NODE_ENV=development
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=optional
COPY . .
CMD ["npm","run","dev"]
