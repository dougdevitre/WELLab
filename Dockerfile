# Stage 1: Node.js builder
FROM node:20-slim AS node-builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY src/frontend/package.json src/frontend/
COPY src/backend/package.json src/backend/

RUN npm ci

COPY tsconfig.json ./
COPY src/frontend/ src/frontend/
COPY src/backend/ src/backend/

RUN npm run build --workspace=src/frontend
RUN npm run build --workspace=src/backend

# Stage 2: Python ML
FROM python:3.11-slim AS ml-builder

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ml/ src/ml/

# Stage 3: Production runtime
FROM node:20-slim AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Node.js built artifacts
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/src/frontend/dist ./src/frontend/dist
COPY --from=node-builder /app/src/backend/dist ./src/backend/dist
COPY --from=node-builder /app/package.json ./

# Copy Python ML artifacts
COPY --from=ml-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=ml-builder /app/src/ml ./src/ml

# Create non-root user
RUN groupadd --gid 1001 wellab && \
    useradd --uid 1001 --gid wellab --shell /bin/bash --create-home wellab && \
    chown -R wellab:wellab /app

USER wellab

EXPOSE 3001 5173 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "src/backend/dist/index.js"]
