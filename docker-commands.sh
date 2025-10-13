#!/bin/bash
# Docker Quick Reference Commands for Inventory Management System

# ==============================================================================
# SETUP AND CONFIGURATION
# ==============================================================================

# Copy environment file and configure
cp .env.example .env
# Edit .env with your settings: nano .env or vim .env

# ==============================================================================
# BUILD AND START
# ==============================================================================

# Build and start all containers in detached mode
docker-compose up -d

# Build without cache (force rebuild)
docker-compose build --no-cache

# Build and start with rebuild
docker-compose up -d --build

# Start specific service
docker-compose up -d backend
docker-compose up -d frontend

# ==============================================================================
# MONITORING AND LOGS
# ==============================================================================

# View logs (all services)
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# View last N lines of logs
docker-compose logs --tail=100 backend

# View logs with timestamps
docker-compose logs -f -t

# Check container status
docker-compose ps

# Monitor resource usage
docker stats

# ==============================================================================
# CONTAINER MANAGEMENT
# ==============================================================================

# Stop containers (preserves data)
docker-compose stop

# Start stopped containers
docker-compose start

# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend

# Stop and remove containers (preserves volumes)
docker-compose down

# Stop, remove containers AND volumes (DELETES DATA!)
docker-compose down -v

# ==============================================================================
# ACCESSING CONTAINERS
# ==============================================================================

# Execute command in backend container
docker-compose exec backend sh

# Execute command in frontend container
docker-compose exec frontend sh

# Run one-off command
docker-compose run --rm backend node --version

# ==============================================================================
# DATABASE MANAGEMENT
# ==============================================================================

# Backup database volume
docker run --rm -v inventory-db-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz /data

# Restore database volume
docker run --rm -v inventory-db-data:/data -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/db-backup-YYYYMMDD.tar.gz --strip 1"

# View database files
docker run --rm -v inventory-db-data:/data alpine ls -lah /data

# Access database directly (from within backend container)
# docker-compose exec backend sh
# sqlite3 /app/database/inventory.db

# ==============================================================================
# VOLUME MANAGEMENT
# ==============================================================================

# List all volumes
docker volume ls | grep inventory

# Inspect specific volume
docker volume inspect inventory-db-data
docker volume inspect inventory-upload-data
docker volume inspect inventory-log-data

# Backup all volumes
docker run --rm -v inventory-db-data:/db -v inventory-upload-data:/uploads \
  -v inventory-log-data:/logs -v $(pwd):/backup alpine sh -c \
  "tar czf /backup/full-backup-$(date +%Y%m%d).tar.gz /db /uploads /logs"

# Remove unused volumes (BE CAREFUL!)
docker volume prune

# ==============================================================================
# HEALTH CHECKS
# ==============================================================================

# Check application health
curl http://localhost/api/health

# Check frontend
curl http://localhost/

# Test backend from inside frontend container
docker-compose exec frontend wget -O- http://backend:5000/api/health

# ==============================================================================
# TROUBLESHOOTING
# ==============================================================================

# View detailed container info
docker inspect inventory-backend
docker inspect inventory-frontend

# Check network connectivity
docker network inspect inventory-network

# View container processes
docker-compose top

# Check nginx configuration (frontend)
docker-compose exec frontend nginx -t

# Reload nginx configuration
docker-compose exec frontend nginx -s reload

# View backend environment variables
docker-compose exec backend env

# ==============================================================================
# IMAGE MANAGEMENT
# ==============================================================================

# List images
docker images | grep inventory

# Remove unused images
docker image prune

# Remove specific image
docker rmi inventory-backend:latest

# Pull latest images from registry
docker-compose pull

# Push images to registry
docker-compose push

# Tag image for registry
docker tag inventory-backend:latest registry.example.com/inventory-backend:v1.0

# ==============================================================================
# PRODUCTION DEPLOYMENT
# ==============================================================================

# Deploy with production settings
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Pull and deploy from registry
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Rolling update (no downtime)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps backend
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps frontend

# ==============================================================================
# CLEANUP
# ==============================================================================

# Remove stopped containers
docker-compose rm

# Remove all unused containers, networks, images
docker system prune

# Remove everything including volumes (DELETES ALL DATA!)
docker system prune -a --volumes

# Clean up specific to this project
docker-compose down -v
docker rmi inventory-backend inventory-frontend
docker volume rm inventory-db-data inventory-upload-data inventory-log-data

# ==============================================================================
# DEVELOPMENT HELPERS
# ==============================================================================

# Watch logs in real-time
watch -n 2 'docker-compose ps'

# Create new backend migration
docker-compose exec backend npm run migrate:create

# Run backend tests
docker-compose exec backend npm test

# Install new backend dependency
docker-compose exec backend npm install package-name
docker-compose restart backend

# Rebuild after code changes
docker-compose up -d --build

# ==============================================================================
# BITBUCKET PIPELINE SIMULATION
# ==============================================================================

# Simulate pipeline build
docker build -t inventory-backend:test ./backend
docker build -t inventory-frontend:test ./frontend

# Test images
docker run -d --name test-backend -p 5000:5000 inventory-backend:test
docker run -d --name test-frontend -p 8080:80 test-frontend
# Test at http://localhost:8080
docker stop test-backend test-frontend
docker rm test-backend test-frontend

# ==============================================================================
# MAINTENANCE
# ==============================================================================

# Update base images and rebuild
docker-compose build --pull --no-cache
docker-compose up -d

# Check disk usage
docker system df

# Export container logs
docker-compose logs > logs-$(date +%Y%m%d).txt

# Create snapshot (all volumes)
mkdir -p backups/$(date +%Y%m%d)
docker run --rm -v inventory-db-data:/db -v $(pwd)/backups/$(date +%Y%m%d):/backup \
  alpine cp -r /db /backup/
