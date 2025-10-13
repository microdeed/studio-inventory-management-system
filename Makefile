.PHONY: help build up down start stop restart logs logs-backend logs-frontend ps clean backup restore health

# Default target
help:
	@echo "Inventory Management System - Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@echo "  setup          - Initial setup (copy .env.example to .env)"
	@echo "  build          - Build all containers"
	@echo "  up             - Build and start all containers"
	@echo "  down           - Stop and remove containers"
	@echo "  start          - Start containers"
	@echo "  stop           - Stop containers"
	@echo "  restart        - Restart all containers"
	@echo "  logs           - View logs (all services)"
	@echo "  logs-backend   - View backend logs"
	@echo "  logs-frontend  - View frontend logs"
	@echo "  ps             - Show container status"
	@echo "  shell-backend  - Access backend shell"
	@echo "  shell-frontend - Access frontend shell"
	@echo "  clean          - Remove containers and images"
	@echo "  clean-all      - Remove everything including volumes (DELETES DATA!)"
	@echo "  backup         - Backup database and uploads"
	@echo "  restore        - Restore from backup (set DATE=YYYYMMDD)"
	@echo "  health         - Check application health"
	@echo "  prod-up        - Deploy in production mode"
	@echo "  prod-down      - Stop production deployment"
	@echo ""

# Initial setup
setup:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file. Please edit it with your configuration."; \
	else \
		echo ".env file already exists."; \
	fi

# Build containers
build:
	docker-compose build --no-cache

# Build and start containers
up:
	docker-compose up -d
	@echo ""
	@echo "Application started!"
	@echo "Frontend: http://localhost"
	@echo "Backend API: http://localhost/api/health"

# Stop and remove containers
down:
	docker-compose down

# Start containers
start:
	docker-compose start

# Stop containers
stop:
	docker-compose stop

# Restart containers
restart:
	docker-compose restart

# View all logs
logs:
	docker-compose logs -f

# View backend logs
logs-backend:
	docker-compose logs -f backend

# View frontend logs
logs-frontend:
	docker-compose logs -f frontend

# Show container status
ps:
	docker-compose ps

# Access backend shell
shell-backend:
	docker-compose exec backend sh

# Access frontend shell
shell-frontend:
	docker-compose exec frontend sh

# Clean containers and images
clean:
	docker-compose down
	docker rmi inventory-backend inventory-frontend 2>/dev/null || true

# Clean everything including volumes (WARNING: DELETES DATA!)
clean-all:
	@echo "WARNING: This will delete all data including database, uploads, and logs!"
	@read -p "Are you sure? (y/N): " confirm; \
	if [ "$$confirm" = "y" ]; then \
		docker-compose down -v; \
		docker rmi inventory-backend inventory-frontend 2>/dev/null || true; \
		echo "All data removed."; \
	else \
		echo "Cancelled."; \
	fi

# Backup database and uploads
backup:
	@mkdir -p backups
	@echo "Backing up database..."
	@docker run --rm -v inventory-db-data:/data -v $$(pwd)/backups:/backup \
		alpine tar czf /backup/db-backup-$$(date +%Y%m%d-%H%M%S).tar.gz /data
	@echo "Backing up uploads..."
	@docker run --rm -v inventory-upload-data:/data -v $$(pwd)/backups:/backup \
		alpine tar czf /backup/uploads-backup-$$(date +%Y%m%d-%H%M%S).tar.gz /data
	@echo "Backup completed! Files saved in ./backups/"

# Restore from backup (use: make restore DATE=20241013)
restore:
	@if [ -z "$(DATE)" ]; then \
		echo "Error: Please specify DATE=YYYYMMDD"; \
		echo "Example: make restore DATE=20241013"; \
		exit 1; \
	fi
	@echo "Restoring database from $(DATE)..."
	@docker run --rm -v inventory-db-data:/data -v $$(pwd)/backups:/backup \
		alpine sh -c "cd /data && tar xzf /backup/db-backup-$(DATE)*.tar.gz --strip 1"
	@echo "Database restored!"

# Health check
health:
	@echo "Checking application health..."
	@curl -f http://localhost/api/health && echo "" || echo "Health check failed!"

# Production deployment
prod-up:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo ""
	@echo "Production deployment started!"

prod-down:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Development: rebuild and restart
dev-restart:
	docker-compose up -d --build

# View resource usage
stats:
	docker stats inventory-backend inventory-frontend

# Test connection between containers
test-connection:
	@echo "Testing backend health from frontend container..."
	@docker-compose exec frontend wget -O- http://backend:5000/api/health
