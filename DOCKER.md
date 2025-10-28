# Docker Deployment Guide

This guide covers deploying the Studio Inventory Management System using Docker with a multi-container setup.

## Architecture

The application consists of three main components:

```
Multi-Container Setup
├── Backend Container (Node.js API) - Port 5000
├── Frontend Container (React + Nginx) - Port 80
└── Volumes for Persistent Storage
    ├── SQLite Database
    ├── File Uploads
    └── Application Logs
```

## Prerequisites

- Docker Engine 20.10 or higher
- Docker Compose 2.0 or higher
- 2GB+ available disk space
- Ports 80 and 5000 available (or configure custom ports)

## Quick Start

### 1. Clone and Configure

```bash
# Navigate to project directory
cd inventory

# Copy environment file and configure
cp .env.example .env
# Edit .env with your settings
```

### 2. Build and Start

```bash
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Check container status
docker-compose ps
```

### 3. Access Application

- Frontend: http://localhost
- Backend API: http://backend:5000 (internal only)
- Health Check: http://localhost/api/health

## Environment Configuration

### Required Variables

Edit `.env` file:

```env
# Frontend port (external access)
FRONTEND_PORT=80

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-jwt-key

# Optional: Email notifications
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### Security Notes

- **NEVER** commit `.env` file to version control
- Change `JWT_SECRET` to a strong random string
- Use environment-specific secrets in production
- SSL/TLS is managed by your organization (outside Docker)

## Container Management

### Start/Stop Containers

```bash
# Start containers
docker-compose up -d

# Stop containers (preserves data)
docker-compose stop

# Stop and remove containers (preserves data in volumes)
docker-compose down

# Stop and remove everything including volumes (DELETES DATA!)
docker-compose down -v
```

### View Logs

```bash
# All containers
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100
```

### Restart Services

```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
docker-compose restart frontend
```

## Data Persistence

Docker volumes ensure data persists across container restarts:

### Volumes

| Volume Name | Purpose | Data Stored |
|-------------|---------|-------------|
| `inventory-db-data` | Database | SQLite database file |
| `inventory-upload-data` | File uploads | Equipment images, documents |
| `inventory-log-data` | Application logs | Activity logs, error logs |

### Backup Volumes

```bash
# Backup database
docker run --rm -v inventory-db-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz /data

# Backup uploads
docker run --rm -v inventory-upload-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-backup-$(date +%Y%m%d).tar.gz /data
```

### Restore Volumes

```bash
# Restore database
docker run --rm -v inventory-db-data:/data -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/db-backup-YYYYMMDD.tar.gz --strip 1"
```

### Inspect Volumes

```bash
# List volumes
docker volume ls | grep inventory

# Inspect volume
docker volume inspect inventory-db-data

# View volume contents
docker run --rm -v inventory-db-data:/data alpine ls -lah /data
```

## Building Images

### Development Build

```bash
# Build without cache
docker-compose build --no-cache

# Build specific service
docker-compose build backend
docker-compose build frontend
```

### Production Build

```bash
# Build with specific tags
docker build -t inventory-backend:v1.0 ./backend
docker build -t inventory-frontend:v1.0 ./frontend
```

## CI/CD with Bitbucket Pipelines

The project includes automated building and pushing to container registries.

### Setup Bitbucket Variables

In Bitbucket Repository Settings > Pipelines > Repository variables, add:

| Variable | Description | Secured |
|----------|-------------|---------|
| `DOCKER_USERNAME` | Docker registry username | No |
| `DOCKER_PASSWORD` | Docker registry password/token | Yes |
| `DOCKER_REGISTRY` | Registry URL (default: docker.io) | No |
| `IMAGE_NAME` | Base image name | No |

### Pipeline Triggers

- **Push to any branch**: Build and test
- **Push to `main`**: Build, tag with commit SHA, push to registry
- **Push to `develop`**: Build dev images
- **Tag `v*`**: Build and push release version

### Manual Pipeline Trigger

```bash
# Push to trigger pipeline
git push origin main

# Create release tag
git tag v1.0.0
git push origin v1.0.0
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend
docker-compose logs frontend

# Check if port is in use
netstat -an | grep :80
netstat -an | grep :5000

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Database Issues

```bash
# Access backend container
docker-compose exec backend sh

# Check database file
ls -lah /app/database/

# Run database migrations manually
node scripts/migrate.js
```

### Frontend Not Loading

```bash
# Check nginx configuration
docker-compose exec frontend cat /etc/nginx/conf.d/default.conf

# Test nginx configuration
docker-compose exec frontend nginx -t

# Rebuild frontend
docker-compose build --no-cache frontend
docker-compose up -d frontend
```

### Network Issues

```bash
# Inspect network
docker network inspect inventory-network

# Test backend connectivity from frontend
docker-compose exec frontend wget -O- http://backend:5000/api/health
```

### Reset Everything

```bash
# WARNING: This deletes ALL data!
docker-compose down -v
docker-compose up -d
```

## Health Checks

Both containers include health checks:

```bash
# Check container health
docker-compose ps

# Backend health check
curl http://localhost/api/health

# Frontend health check
curl http://localhost/
```

## Performance Optimization

### Resource Limits

Add to `docker-compose.yml` under each service:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      memory: 256M
```

### Image Size Optimization

The images use multi-stage builds and alpine base images:

- Backend: ~150MB
- Frontend: ~25MB (nginx + static files)

### Monitoring

```bash
# Resource usage
docker stats

# Specific container
docker stats inventory-backend
```

## Production Deployment

### Recommended Setup

1. Use a reverse proxy (nginx/traefik) for SSL termination
2. Set resource limits in docker-compose.yml
3. Use Docker Swarm or Kubernetes for orchestration
4. Implement log aggregation (ELK stack, Grafana Loki)
5. Set up monitoring (Prometheus, Grafana)
6. Configure automated backups
7. Use secrets management (Docker secrets, Vault)

### Security Checklist

- [ ] Change default JWT_SECRET
- [ ] Use strong database credentials
- [ ] Enable firewall rules
- [ ] Keep Docker updated
- [ ] Scan images for vulnerabilities
- [ ] Use non-root users (already configured)
- [ ] Implement rate limiting
- [ ] Regular security updates

## Updating the Application

```bash
# Pull latest images
docker-compose pull

# Rebuild from source
docker-compose build --no-cache

# Restart with new images
docker-compose up -d

# Remove old images
docker image prune
```

## Support

For issues or questions:

1. Check container logs: `docker-compose logs -f`
2. Verify environment configuration in `.env`
3. Review this documentation
4. Check Docker and system resources

## Architecture Details

### Backend Container

- Base: `node:18-alpine`
- Process Manager: `dumb-init`
- User: `node` (non-root)
- Exposed Port: 5000 (internal only)
- Health Check: HTTP GET /api/health

### Frontend Container

- Base: `nginx:alpine`
- Build: Multi-stage (Node.js build + Nginx serve)
- Exposed Port: 80
- Features: Gzip, security headers, API proxy

### Network

- Type: Bridge network
- Name: `inventory-network`
- Internal communication: Service names (backend, frontend)
- External access: Frontend only via port 80

## Docker Image Distribution via Git Repository

This section covers managing and distributing Docker images through the Bitbucket repository.

### Why Store Images in the Repository?

When you don't have access to a container registry (Docker Hub, AWS ECR, etc.), you can distribute Docker images through your Git repository:

- Share images with team members without a registry
- Version control for images alongside code
- Works in air-gapped or restricted network environments
- Simple deployment to environments without build capabilities

### Image Export and Push Workflow

#### 1. Build Docker Images

```bash
# Build all services
docker-compose build

# Or build individually
docker-compose build backend
docker-compose build frontend
```

#### 2. Export Images to Tar Files

```bash
# Export backend image
docker save -o inventory-backend.tar inventory-backend:latest

# Export frontend image
docker save -o inventory-frontend.tar inventory-frontend:latest

# Verify tar files were created
ls -lh *.tar
```

#### 3. Switch to Images Branch

```bash
# Create and switch to images branch (first time)
git checkout -b main/release/images

# Or switch to existing branch
git checkout main/release/images
```

#### 4. Add and Commit Images

```bash
# Add tar files to git
git add inventory-backend.tar inventory-frontend.tar

# Commit with descriptive message
git commit -m "Update Docker images - $(date +%Y-%m-%d)"

# Or with version tag
git commit -m "Docker images v1.0.0 - Production release"
```

#### 5. Push to Bitbucket

```bash
# Push to remote (first time)
git push -u origin main/release/images

# Subsequent pushes
git push origin main/release/images
```

#### 6. Return to Main Branch

```bash
# Switch back to main branch
git checkout main

# Optional: Delete local tar files to save space
rm inventory-backend.tar inventory-frontend.tar
```

### Image Import and Load Workflow

#### 1. Clone or Pull Images Branch

```bash
# Clone repository if not already done
git clone https://bitbucket.org/your-org/inventory.git
cd inventory

# Fetch and checkout images branch
git fetch origin main/release/images
git checkout main/release/images
```

#### 2. Load Images into Docker

```bash
# Load backend image
docker load -i inventory-backend.tar

# Load frontend image
docker load -i inventory-frontend.tar

# Verify images are loaded
docker images | grep inventory
```

#### 3. Switch Back and Deploy

```bash
# Return to main branch
git checkout main

# Start containers using loaded images
docker-compose up -d
```

### Complete Workflow Example

**Developer Workflow (Build and Push):**

```bash
# 1. Build images from current code
docker-compose build

# 2. Export to tar files
docker save -o inventory-backend.tar inventory-backend:latest
docker save -o inventory-frontend.tar inventory-frontend:latest

# 3. Switch to images branch
git checkout -b main/release/images

# 4. Commit and push
git add inventory-backend.tar inventory-frontend.tar
git commit -m "Docker images - $(date +%Y-%m-%d)"
git push -u origin main/release/images

# 5. Clean up
git checkout main
rm *.tar
```

**Deployment Workflow (Pull and Load):**

```bash
# 1. Get latest images from repository
git fetch origin main/release/images
git checkout main/release/images

# 2. Load images
docker load -i inventory-backend.tar
docker load -i inventory-frontend.tar

# 3. Return to main branch
git checkout main

# 4. Start application
docker-compose up -d

# 5. Verify deployment
docker-compose ps
curl http://localhost/api/health
```

### Image Management Best Practices

#### Version Tagging

```bash
# Tag images with version before saving
docker tag inventory-backend:latest inventory-backend:v1.0.0
docker tag inventory-frontend:latest inventory-frontend:v1.0.0

# Save with version tag
docker save -o inventory-backend-v1.0.0.tar inventory-backend:v1.0.0
docker save -o inventory-frontend-v1.0.0.tar inventory-frontend:v1.0.0

# Commit with clear version
git commit -m "Release v1.0.0 - Docker images"
git tag v1.0.0
git push origin main/release/images --tags
```

#### Image Size Considerations

```bash
# Check tar file sizes
ls -lh *.tar

# Optimize images before export
docker image prune -f
docker-compose build --no-cache

# Compress tar files (optional, if size is critical)
gzip inventory-backend.tar
gzip inventory-frontend.tar

# Load compressed images
gunzip -c inventory-backend.tar.gz | docker load
gunzip -c inventory-frontend.tar.gz | docker load
```

#### Branch Organization

```
Repository Branches:
├── main                    # Source code
├── develop                 # Development code
└── main/release/images     # Docker images (.tar files)
    ├── inventory-backend.tar
    ├── inventory-frontend.tar
    └── README.md (version info)
```

#### Create Image Release Notes

Create a README in the images branch:

```bash
# On main/release/images branch
cat > README.md << 'EOF'
# Docker Images

## Latest Release

- **Date**: 2025-10-16
- **Version**: v1.0.0
- **Backend Image**: inventory-backend.tar (150MB)
- **Frontend Image**: inventory-frontend.tar (25MB)

## Load Instructions

```bash
docker load -i inventory-backend.tar
docker load -i inventory-frontend.tar
docker-compose up -d
```

## Version History

- v1.0.0 (2025-10-16) - Initial production release
EOF

git add README.md
git commit -m "Add image documentation"
git push origin main/release/images
```

### Troubleshooting Image Distribution

#### Image Not Loading

```bash
# Verify tar file integrity
file inventory-backend.tar

# Check tar file is not corrupted
tar -tzf inventory-backend.tar > /dev/null

# Re-export if needed
docker save -o inventory-backend.tar inventory-backend:latest
```

#### Git Push Fails (File Too Large)

```bash
# Check file size
ls -lh *.tar

# If files are too large for Git (>100MB), consider:
# 1. Use Git LFS (Large File Storage)
git lfs install
git lfs track "*.tar"
git add .gitattributes
git add *.tar
git commit -m "Add Docker images via Git LFS"
git push origin main/release/images

# 2. Or use compression
gzip *.tar
git add *.tar.gz
```

#### Wrong Image Version Loaded

```bash
# Check loaded images
docker images | grep inventory

# Remove old images
docker rmi inventory-backend:old-tag
docker rmi inventory-frontend:old-tag

# Load correct version
docker load -i inventory-backend.tar
docker images | grep inventory
```

### Automated Image Export Script

Create a helper script `scripts/export-images.sh`:

```bash
#!/bin/bash

# Build and export Docker images to tar files

set -e

echo "Building Docker images..."
docker-compose build

echo "Exporting backend image..."
docker save -o inventory-backend.tar inventory-backend:latest

echo "Exporting frontend image..."
docker save -o inventory-frontend.tar inventory-frontend:latest

echo "Images exported successfully:"
ls -lh inventory-*.tar

echo ""
echo "Next steps:"
echo "1. git checkout main/release/images"
echo "2. git add inventory-*.tar"
echo "3. git commit -m \"Docker images - \$(date +%Y-%m-%d)\""
echo "4. git push origin main/release/images"
```

Make it executable:

```bash
chmod +x scripts/export-images.sh
./scripts/export-images.sh
```

### Automated Image Import Script

Create a helper script `scripts/import-images.sh`:

```bash
#!/bin/bash

# Import Docker images from tar files

set -e

CURRENT_BRANCH=$(git branch --show-current)

echo "Fetching images branch..."
git fetch origin main/release/images

echo "Switching to images branch..."
git checkout main/release/images

echo "Loading backend image..."
docker load -i inventory-backend.tar

echo "Loading frontend image..."
docker load -i inventory-frontend.tar

echo "Returning to original branch..."
git checkout "$CURRENT_BRANCH"

echo ""
echo "Images loaded successfully:"
docker images | grep inventory

echo ""
echo "To start the application:"
echo "docker-compose up -d"
```

Make it executable:

```bash
chmod +x scripts/import-images.sh
./scripts/import-images.sh
```

## Files Structure

```
inventory/
├── docker-compose.yml          # Orchestration configuration
├── docker-compose.prod.yml     # Production overrides
├── .env.example               # Environment template
├── .env                       # Your configuration (gitignored)
├── bitbucket-pipelines.yml    # CI/CD configuration
├── scripts/
│   ├── export-images.sh       # Image export helper
│   └── import-images.sh       # Image import helper
├── backend/
│   ├── Dockerfile             # Backend image definition
│   ├── .dockerignore          # Build exclusions
│   └── ...
├── frontend/
│   ├── Dockerfile             # Frontend image definition
│   ├── nginx.conf             # Nginx configuration
│   ├── .dockerignore          # Build exclusions
│   └── ...
└── DOCKER.md                  # This file
```

## Branch Structure

```
Repository Branches:
├── main                       # Main source code
├── develop                    # Development branch
└── main/release/images        # Docker images (.tar files)
    ├── inventory-backend.tar  # Backend Docker image
    ├── inventory-frontend.tar # Frontend Docker image
    └── README.md             # Image version info
```
