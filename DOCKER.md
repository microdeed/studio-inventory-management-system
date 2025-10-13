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

## Files Structure

```
inventory/
├── docker-compose.yml          # Orchestration configuration
├── .env.example               # Environment template
├── .env                       # Your configuration (gitignored)
├── bitbucket-pipelines.yml    # CI/CD configuration
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
