FROM node:20-alpine

WORKDIR /app

# Install build tools for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application code
COPY server.js schema.sql seed.js seed-default.js start-session.js ./
COPY public/ ./public/

# Database lives in a volume so it persists across container restarts
ENV DB_PATH=/data/app.db
VOLUME /data

EXPOSE 3000

# On first run, server.js auto-creates the DB from schema.sql if it doesn't exist.
# To seed with data, run: docker exec <container> node seed.js
# (requires _extracted/ CSVs mounted or copied in)
CMD ["node", "server.js"]
