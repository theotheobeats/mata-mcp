# Multi-stage build for MCP Vision Bridge

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for building
RUN apk update && apk upgrade && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcp -u 1001

# Set working directory
WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=mcp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mcp:nodejs /app/dist ./dist
COPY --from=builder --chown=mcp:nodejs /app/package*.json ./
COPY --from=builder --chown=mcp:nodejs /app/healthcheck.js ./

# Create necessary directories
RUN mkdir -p logs /tmp/vision-bridge && \
    chown -R mcp:nodejs logs /tmp/vision-bridge

# Switch to non-root user
USER mcp

# Expose ports
EXPOSE 3000 9090 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node healthcheck.js

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/server/mcp-server.js"]
