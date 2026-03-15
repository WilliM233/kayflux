#!/bin/bash
# KayFlux Docker Deploy Script
# Safe update: stops container, rebuilds image, restarts with existing volume data.
#
# Usage:
#   ./deploy.sh              # Default: container=kayflux, port=3000, volume=kayflux-data
#   ./deploy.sh -p 3030      # Custom port
#   ./deploy.sh -n my-kf     # Custom container name
#   ./deploy.sh -v my-vol    # Custom volume name

set -e

# Defaults
CONTAINER_NAME="kayflux"
HOST_PORT="3000"
VOLUME_NAME="kayflux-data"
IMAGE_NAME="kayflux"

# Parse flags
while getopts "n:p:v:" opt; do
  case $opt in
    n) CONTAINER_NAME="$OPTARG" ;;
    p) HOST_PORT="$OPTARG" ;;
    v) VOLUME_NAME="$OPTARG" ;;
    *) echo "Usage: $0 [-n container_name] [-p port] [-v volume_name]"; exit 1 ;;
  esac
done

echo "=== KayFlux Deploy ==="
echo "Container: $CONTAINER_NAME"
echo "Port:      $HOST_PORT:3000"
echo "Volume:    $VOLUME_NAME:/data"
echo ""

# 1. Verify the volume exists and has data (if container was running before)
if docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1; then
  echo "[1/5] Volume '$VOLUME_NAME' exists — your database will be preserved."
else
  echo "[1/5] Volume '$VOLUME_NAME' does not exist — will be created (fresh database)."
fi

# 2. Stop and remove existing container (if running)
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[2/5] Stopping and removing existing container..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
else
  echo "[2/5] No existing container to stop."
fi

# 3. Pull latest code (if in a git repo)
if [ -d .git ]; then
  echo "[3/5] Pulling latest code..."
  git pull origin main
else
  echo "[3/5] Not a git repo — skipping pull."
fi

# 4. Rebuild image
echo "[4/5] Building Docker image..."
docker build -t "$IMAGE_NAME" .

# 5. Start new container with volume
echo "[5/5] Starting container..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "${HOST_PORT}:3000" \
  -v "${VOLUME_NAME}:/data" \
  "$IMAGE_NAME"

echo ""
echo "=== Deploy complete ==="
echo "KayFlux is running at http://localhost:${HOST_PORT}"
echo ""

# Quick health check
sleep 2
if curl -sf "http://localhost:${HOST_PORT}/api/brands" > /dev/null 2>&1; then
  echo "Health check: OK"
else
  echo "Health check: Container started but API not responding yet."
  echo "Check logs: docker logs $CONTAINER_NAME"
fi
