# Frontend Dockerfile - Multi-stage build for React app (Multi-arch: amd64, arm64, arm/v7)
# Build stage - Use native platform for faster builds since output is platform-independent
FROM --platform=$BUILDPLATFORM node:18-alpine AS builder

# Build arguments for multi-platform support
ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG REACT_APP_VERSION=1.0.0

RUN echo "Building for ${TARGETPLATFORM:-unknown} on ${BUILDPLATFORM:-unknown}"

# Install build tools for native modules (webpack, fsevents, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev

ENV REACT_APP_VERSION=$REACT_APP_VERSION

# Set working directory
WORKDIR /app

# Copy frontend package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy frontend source code
COPY frontend/ .

# Build the application
RUN npm run build

# Production stage - Uses target platform for nginx
FROM nginx:alpine

# Build arguments for platform awareness
ARG TARGETPLATFORM
RUN echo "Production image for ${TARGETPLATFORM:-unknown}"

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
