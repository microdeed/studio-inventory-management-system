# Backend Dockerfile - Node.js API
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

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
