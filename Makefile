# ═══════════════════════════════════════════════════════════════════════════
# ThreatPulse Intel — operations Makefile
#
#   make setup        create .env.prod from the template
#   make ssl          obtain / renew Let's Encrypt certificates
#   make up           start the production stack (detached)
#   make down         stop the stack
#   make logs         follow all logs
#   make update       pull, rebuild images, restart
#   make backup-db    dump the database to backups/<timestamp>.sql.gz
#   make restore-db   restore from the latest backup
#   make shell-app    shell into the app container
#   make shell-db     psql shell
#   make create-admin create a SUPERADMIN user
#   make seed         run the seed script
#   make status       docker compose ps
# ═══════════════════════════════════════════════════════════════════════════

COMPOSE      := docker compose -f docker-compose.prod.yml
COMPOSE_DEV  := docker compose -f docker-compose.dev.yml
ENV_FILE     := .env.prod
BACKUP_DIR   := backups
TS           := $(shell date +%Y%m%d_%H%M%S)

# Load DB creds from .env.prod when present (for backup/restore/psql targets).
ifneq (,$(wildcard $(ENV_FILE)))
include $(ENV_FILE)
export
endif
POSTGRES_USER ?= threatpulse
POSTGRES_DB   ?= threatpulse

.DEFAULT_GOAL := help
.PHONY: help setup ssl up down logs update backup-db restore-db \
        shell-app shell-db create-admin seed status build dev dev-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

setup: ## Create .env.prod from the template
	@if [ -f $(ENV_FILE) ]; then \
	  echo "$(ENV_FILE) already exists — leaving it untouched."; \
	else \
	  cp .env.prod.example $(ENV_FILE); \
	  echo "Created $(ENV_FILE)."; \
	  echo ">>> Now edit $(ENV_FILE): set DOMAIN, NEXTAUTH_URL, NEXTAUTH_SECRET, POSTGRES_PASSWORD, DATABASE_URL, CERTBOT_EMAIL."; \
	  echo ">>> Generate a secret with:  openssl rand -base64 32"; \
	fi

ssl: ## Obtain / renew Let's Encrypt certificates
	@chmod +x scripts/init-letsencrypt.sh
	@./scripts/init-letsencrypt.sh

build: ## Build all production images
	$(COMPOSE) build

up: ## Start the production stack (detached)
	$(COMPOSE) up -d --build
	@echo "Stack is starting. Follow logs with: make logs"

down: ## Stop the production stack
	$(COMPOSE) down

logs: ## Follow logs from all services
	$(COMPOSE) logs -f

update: ## Pull latest code, rebuild images, restart
	@echo "==> Pulling latest changes"
	-git pull --ff-only
	@echo "==> Rebuilding & restarting"
	$(COMPOSE) up -d --build
	@echo "==> Pruning dangling images"
	-docker image prune -f

backup-db: ## Dump the database to backups/<timestamp>.sql.gz
	@mkdir -p $(BACKUP_DIR)
	@echo "==> Backing up database to $(BACKUP_DIR)/db_$(TS).sql.gz"
	$(COMPOSE) exec -T postgres pg_dump -U $(POSTGRES_USER) -d $(POSTGRES_DB) | gzip > $(BACKUP_DIR)/db_$(TS).sql.gz
	@echo "==> Done: $(BACKUP_DIR)/db_$(TS).sql.gz"

restore-db: ## Restore from the latest backup in backups/
	@LATEST=$$(ls -1t $(BACKUP_DIR)/db_*.sql.gz 2>/dev/null | head -n1); \
	if [ -z "$$LATEST" ]; then echo "No backups found in $(BACKUP_DIR)/"; exit 1; fi; \
	echo "==> Restoring from $$LATEST"; \
	gunzip -c "$$LATEST" | $(COMPOSE) exec -T postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB); \
	echo "==> Restore complete."

shell-app: ## Shell into the app container
	$(COMPOSE) exec app sh

shell-db: ## Open a psql shell
	$(COMPOSE) exec postgres psql -U $(POSTGRES_USER) -d $(POSTGRES_DB)

create-admin: ## Create a SUPERADMIN user (prompts, or pass EMAIL=/PASSWORD=/ORG_NAME=)
	@chmod +x scripts/create-admin.sh
	@COMPOSE_FILE=docker-compose.prod.yml ./scripts/create-admin.sh

seed: ## Run the seed script (idempotent)
	$(COMPOSE) exec app sh -c "cd /app/prisma-tools && NODE_PATH=/app/prisma-tools/node_modules npx tsx scripts/seed.ts"

status: ## Show container status
	$(COMPOSE) ps

# ── Development helpers ──────────────────────────────────────────────────────
dev: ## Start the dev stack (hot reload, no SSL)
	$(COMPOSE_DEV) up --build

dev-down: ## Stop the dev stack
	$(COMPOSE_DEV) down
