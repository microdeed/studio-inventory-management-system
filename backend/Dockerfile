# Backend Dockerfile - Node.js API (Multi-arch: amd64, arm64, arm/v7)
FROM node:18-alpine

# Build arguments for multi-platform support
ARG TARGETPLATFORM
ARG BUILDPLATFORM
RUN echo "Building for ${TARGETPLATFORM:-unknown} on ${BUILDPLATFORM:-unknown}"

# Install dumb-init for proper signal handling and build tools for native modules
RUN apk add --no-cache \
    dumb-init \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    ca-certificates

# Create Python symlink for node-gyp compatibility
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy version.json from root
COPY version.json ./

# Copy backend package files
COPY backend/package*.json ./

# Install dependencies with verbose logging for debugging
RUN npm ci --only=production --loglevel=verbose && npm cache clean --force

# Remove build dependencies to reduce image size
RUN apk del python3 make g++ gcc libc-dev

# Copy backend application code
COPY backend/ .

# Create necessary directories with proper permissions
# database/ = schema/migrations (in image), data/ = database file (in volume)
RUN mkdir -p uploads logs data && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    DB_PATH=/app/data/inventory.db \
    UPLOAD_DIR=/app/uploads

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
