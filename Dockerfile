# -- Build stage: compile native modules --
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# -- Production stage --
FROM node:20-alpine

LABEL org.opencontainers.image.source="https://github.com/WilliM233/kayflux"

# Non-root user for security
RUN addgroup kayflux && adduser -S kayflux -G kayflux

WORKDIR /app

# Copy built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY package.json ./
COPY server.js schema.sql seed.js seed-default.js start-session.js ./
COPY public/ ./public/

# Database lives in a volume so it persists across container restarts
ENV DB_PATH=/data/app.db
ENV NODE_ENV=production
ENV PORT=3000

# Create data directory owned by kayflux user
RUN mkdir -p /data && chown -R kayflux:kayflux /data /app

VOLUME /data

EXPOSE 3000

USER kayflux

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/brands || exit 1

# On first run, server.js auto-creates the DB from schema.sql if it doesn't exist.
# To seed with data, run: docker exec <container> node seed.js
CMD ["node", "server.js"]
