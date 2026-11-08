# Multi-stage Dockerfile for DevPulse Frontend React SPA

# Stage 1: Build static web assets
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time environment argument for API base URL (defaults to relative /api)
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code and build configs
COPY tsconfig*.json vite.config.ts tailwind.config.ts postcss.config.js index.html ./
COPY src/ ./src/

# Build optimized production bundle
RUN npm run build

# Stage 2: Production runtime using lightweight Nginx Alpine
FROM nginx:1.27-alpine AS runner

# Remove default Nginx welcome page and config
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration for SPA routing
COPY deploy/nginx/frontend.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Healthcheck to verify Nginx serves frontend HTML
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
