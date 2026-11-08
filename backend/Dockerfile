# Multi-stage Dockerfile for DevPulse Backend API Service

# Stage 1: Build TypeScript source code
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies required for tsc compilation)
RUN npm ci

# Copy backend source code and config
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript to JavaScript
RUN npm run build

# Prune devDependencies to keep only production packages
RUN npm prune --omit=dev

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production
ENV PORT=5000

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy compiled JavaScript output
COPY --from=builder /app/dist ./dist

# Run container as non-root user for security hardening
USER node

# Expose internal API port
EXPOSE 5000

# Docker healthcheck querying backend health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

# Start backend server
CMD ["node", "dist/server.js"]
