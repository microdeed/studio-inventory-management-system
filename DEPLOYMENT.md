# Deployment Guide

## Local Development

The project automatically uses your local database when you run:

```bash
docker compose up -d
```

This works because `docker-compose.override.yml` (not committed to repo) bind-mounts your local `backend/database/` directory.

## Production Deployment

### First Time Setup

1. Clone the repository
2. Build and start containers:

```bash
docker compose up -d
```

The database will automatically initialize with the schema from `backend/database/init.sql`, creating:
- Default admin user (username: `admin`, email: `admin@studio.com`)
- Equipment categories
- All necessary tables

### Environment Variables

Create a `.env` file in the project root:

```env
# Production settings
JWT_SECRET=your-secure-random-secret-here
FRONTEND_PORT=80
```

### Data Persistence

Production uses Docker volumes for data persistence:
- `inventory-db-data` - SQLite database
- `inventory-upload-data` - Uploaded files (images, QR codes)
- `inventory-log-data` - Application logs

These volumes persist across container restarts and updates.

### Updating the Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build

# Database is preserved in volumes
```

### Backup & Restore

**Backup database:**
```bash
docker compose exec backend cp /app/data/inventory.db /app/data/inventory.backup.db
docker cp inventory-backend:/app/data/inventory.backup.db ./backup-$(date +%Y%m%d).db
```

**Restore database:**
```bash
docker cp ./backup-20241013.db inventory-backend:/app/data/inventory.db
docker compose restart backend
```

## Architecture

```
Production (committed to repo):
├── docker-compose.yml          ← Volume-based storage
├── backend/
│   ├── database/
│   │   ├── init.sql            ← Schema (creates empty DB)
│   │   ├── migrations/         ← Schema updates
│   │   └── connection.js       ← Auto-initializes from init.sql
│   └── Dockerfile
└── frontend/
    └── Dockerfile

Local Development (not committed):
└── docker-compose.override.yml  ← Bind-mounts your existing database
```

## URLs

- **Frontend:** http://localhost (or your FRONTEND_PORT)
- **Backend API:** http://localhost/api
- **Health Check:** http://localhost/api/health
