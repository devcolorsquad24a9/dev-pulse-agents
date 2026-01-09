.PHONY: help dev stop status setup-docker-env setup-check logs logs-follow logs-help docker-down restart clean build pull-vercel-env add-env-var neon-setup neon-branch-preview-create neon-connection-strings migrate-preview migrate-production migrate-info migrate-clean migrate-subscribers migrate-subscribers-info

# Default target
.DEFAULT_GOAL := help

# Variables
BACKEND_PORT := 3000
DB_PORT := 5432
NEON_PROJECT_ID ?= $(shell neonctl projects list --output json 2>/dev/null | jq -r '.[0].id' 2>/dev/null || echo "")

# Colors for output
GREEN := \033[0;32m
BLUE := \033[0;34m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Available commands:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(BLUE)Quick Start:$(NC)"
	@echo ""
	@echo "  1. Setup environment:  $(GREEN)make setup-docker-env$(NC)"
	@echo "  2. Start services:     $(GREEN)make dev$(NC)"
	@echo "  3. Stop services:      $(GREEN)make stop$(NC)"
	@echo "  4. View logs:          $(GREEN)make logs$(NC)"
	@echo ""

setup-check: ## Check if environment files are set up correctly
	@echo "$(BLUE)🔍 Checking environment file setup...$(NC)"
	@echo ""
	@if [ -f ".env.local" ]; then \
		echo "$(GREEN)✅ .env.local exists$(NC)"; \
	else \
		echo "$(YELLOW)❌ .env.local missing$(NC)"; \
		echo "   Run: make setup-docker-env"; \
	fi
	@echo ""

setup-docker-env: ## Ensure .env.local exists with correct DATABASE_URL for Neon Local (preview branch)
	@echo "$(BLUE)🔧 Setting up Docker environment file...$(NC)"
	@if [ ! -f ".env.local" ]; then \
		echo "$(YELLOW)⚠️  .env.local not found. Creating minimal .env.local...$(NC)"; \
		echo "DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify" > .env.local; \
		echo "$(GREEN)✅ Created .env.local with DATABASE_URL$(NC)"; \
	else \
		echo "$(GREEN)✅ .env.local exists$(NC)"; \
		if grep -q "^DATABASE_URL=" .env.local; then \
			if ! grep -q "ep-calm-lake-ahc8d6st" .env.local; then \
				sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify|' .env.local; \
				echo "$(GREEN)   Updated DATABASE_URL for Neon Local (preview branch)$(NC)"; \
			else \
				echo "$(BLUE)   DATABASE_URL already configured for preview branch$(NC)"; \
			fi; \
		else \
			echo "DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify" >> .env.local; \
			echo "$(GREEN)   Added DATABASE_URL for Neon Local$(NC)"; \
		fi; \
	fi
	@echo "$(GREEN)✅ Docker environment file ready!$(NC)"
	@echo "$(BLUE)   File: .env.local$(NC)"
	@echo "$(BLUE)   Note: Neon Local is configured to proxy to preview branch$(NC)"

dev: setup-docker-env ## Start backend and Neon Local database with Docker Compose
	@echo "$(BLUE)🐳 Starting services with Docker Compose + Neon Local...$(NC)"
	@echo "$(GREEN)Backend will run on: http://localhost:$(BACKEND_PORT)$(NC)"
	@echo "$(GREEN)Database will run on: localhost:$(DB_PORT)$(NC)"
	@echo "$(GREEN)Using Neon Local (connects to Neon cloud database)$(NC)"
	@echo ""
	@docker compose --profile dev up -d backend neon-local

stop: ## Stop all running Docker Compose services
	@echo "$(BLUE)🛑 Stopping Docker Compose services...$(NC)"
	@docker compose --profile dev down 2>/dev/null && echo "$(GREEN)✅ Stopped Docker Compose services$(NC)" || echo "$(YELLOW)⚠️  No Docker Compose services running$(NC)"

restart: stop dev ## Restart all services

status: ## Show status of running services
	@echo "$(BLUE)📊 Service Status:$(NC)"
	@echo ""
	@if docker ps 2>/dev/null | grep -q "dev-pulse-agents-backend"; then \
		echo "$(GREEN)✅ Backend (Docker): Running$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  Backend (Docker): Not running$(NC)"; \
	fi
	@if docker ps 2>/dev/null | grep -q "neon-local"; then \
		echo "$(GREEN)✅ Neon Local: Running$(NC)"; \
	else \
		echo "$(YELLOW)⚠️  Neon Local: Not running$(NC)"; \
	fi
	@echo ""
	@lsof -ti:$(BACKEND_PORT),$(DB_PORT) 2>/dev/null | while IFS= read -r pid || [ -n "$$pid" ]; do \
		if [ -n "$$pid" ]; then \
			echo "$(BLUE)  Process $$pid listening on: $$(lsof -p $$pid 2>/dev/null | grep LISTEN | awk '{print $$9}' | head -1)$(NC)"; \
		fi; \
	done || true

logs: ## Show Docker Compose logs (use LOGS_SERVICE=backend or LOGS_SERVICE=neon-local for specific service)
	@if [ -n "$(LOGS_SERVICE)" ]; then \
		echo "$(BLUE)📋 Showing logs for $(LOGS_SERVICE)...$(NC)"; \
		docker compose --profile dev logs $(LOGS_SERVICE); \
	else \
		echo "$(BLUE)📋 Showing all Docker Compose logs...$(NC)"; \
		docker compose --profile dev logs; \
	fi

logs-follow: ## Follow Docker Compose logs in real-time (use LOGS_SERVICE=backend or LOGS_SERVICE=neon-local for specific service)
	@if [ -n "$(LOGS_SERVICE)" ]; then \
		echo "$(BLUE)📋 Following logs for $(LOGS_SERVICE)...$(NC)"; \
		docker compose --profile dev logs -f $(LOGS_SERVICE); \
	else \
		echo "$(BLUE)📋 Following all Docker Compose logs...$(NC)"; \
		docker compose --profile dev logs -f; \
	fi

logs-help: ## Show log viewing help and API examples
	@echo "$(BLUE)📋 Docker Compose Logs Help$(NC)"
	@echo ""
	@echo "$(GREEN)Available log commands:$(NC)"
	@echo "  make logs                    - Show all logs"
	@echo "  make logs-follow              - Follow all logs (live)"
	@echo "  make logs LOGS_SERVICE=backend - Show backend logs"
	@echo "  make logs LOGS_SERVICE=neon-local - Show neon-local logs"
	@echo "  make logs-follow LOGS_SERVICE=backend - Follow backend logs"
	@echo ""
	@echo "$(GREEN)To check API responses:$(NC)"
	@echo "  Health check:  curl http://localhost:$(BACKEND_PORT)/health"
	@echo "  Web Search:     curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/web-search -H 'Content-Type: application/json' -d '{\"query\":\"test\"}'"
	@echo "  Comparison:     curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/comparison -H 'Content-Type: application/json' -d '{\"items\":[\"item1\",\"item2\"]}'"
	@echo "  Recommendation: curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/recommendation -H 'Content-Type: application/json' -d '{\"context\":\"test\"}'"
	@echo "  Newsletter:     curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/newsletter -H 'Content-Type: application/json' -d '{\"topics\":[\"topic1\"]}'"

docker-down: ## Stop all Docker services and remove containers
	@echo "$(BLUE)🛑 Stopping Docker services...$(NC)"
	@docker compose --profile dev down

clean: ## Remove containers, volumes, and built images
	@echo "$(BLUE)🧹 Cleaning up Docker resources...$(NC)"
	@docker compose --profile dev down -v --rmi local 2>/dev/null || true
	@echo "$(GREEN)✅ Cleanup complete$(NC)"

build: ## Build Docker images without starting services
	@echo "$(BLUE)🔨 Building Docker images...$(NC)"
	@docker compose --profile dev build

pull-vercel-env: ## Pull environment variables from Vercel to .env.local
	@echo "$(BLUE)📥 Pulling environment variables from Vercel...$(NC)"
	@if ! command -v vercel >/dev/null 2>&1; then \
		echo "$(YELLOW)❌ Vercel CLI not found$(NC)"; \
		echo "$(YELLOW)   Install it with: npm install -g vercel$(NC)"; \
		echo "$(YELLOW)   Or: brew install vercel-cli$(NC)"; \
		exit 1; \
	fi
	@if [ -f ".env.local" ]; then \
		echo "$(YELLOW)⚠️  .env.local already exists. Backing up to .env.local.backup$(NC)"; \
		cp .env.local .env.local.backup; \
		BACKUP_DATABASE_URL=$$(grep "^DATABASE_URL=" .env.local 2>/dev/null || echo ""); \
		vercel env pull .env.local; \
		if [ -n "$$BACKUP_DATABASE_URL" ]; then \
			echo "$(GREEN)   Restoring local DATABASE_URL for Neon Local$(NC)"; \
			if grep -q "^DATABASE_URL=" .env.local; then \
				sed -i '' "s|^DATABASE_URL=.*|$$BACKUP_DATABASE_URL|" .env.local; \
			else \
				echo "$$BACKUP_DATABASE_URL" >> .env.local; \
			fi; \
		fi; \
		echo "$(GREEN)✅ Environment variables pulled from Vercel$(NC)"; \
		echo "$(GREEN)   Local DATABASE_URL preserved for Neon Local$(NC)"; \
	else \
		vercel env pull .env.local; \
		if ! grep -q "^DATABASE_URL=" .env.local; then \
			echo "$(GREEN)   Adding DATABASE_URL for Neon Local$(NC)"; \
			echo "DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify" >> .env.local; \
		fi; \
		echo "$(GREEN)✅ Environment variables pulled from Vercel$(NC)"; \
	fi
	@echo "$(BLUE)   File: .env.local$(NC)"

add-env-var: ## Add environment variable to Vercel project (usage: make add-env-var KEY=var_name VALUE=var_value [ENV=development|preview|production])
	@echo "$(BLUE)➕ Adding environment variable to Vercel project...$(NC)"
	@if ! command -v vercel >/dev/null 2>&1; then \
		echo "$(YELLOW)❌ Vercel CLI not found$(NC)"; \
		echo "$(YELLOW)   Install it with: npm install -g vercel$(NC)"; \
		echo "$(YELLOW)   Or: brew install vercel-cli$(NC)"; \
		exit 1; \
	fi
	@if [ -z "$(KEY)" ]; then \
		echo "$(YELLOW)❌ KEY is required$(NC)"; \
		echo "$(BLUE)💡 Usage: make add-env-var KEY=VAR_NAME VALUE=var_value [ENV=development|preview|production]$(NC)"; \
		echo "$(BLUE)   Examples:$(NC)"; \
		echo "$(BLUE)     # Add to all environments (non-interactive):$(NC)"; \
		echo "$(BLUE)     make add-env-var KEY=FIRECRAWL_API_KEY VALUE=fc-...$(NC)"; \
		echo "$(BLUE)     # Add to specific environment (non-interactive):$(NC)"; \
		echo "$(BLUE)     make add-env-var KEY=OPENAI_API_KEY ENV=production VALUE=sk-...$(NC)"; \
		echo "$(BLUE)   $(NC)"; \
		echo "$(YELLOW)⚠️  Warning: VALUE may be saved in shell history$(NC)"; \
		exit 1; \
	fi
	@if [ -z "$(VALUE)" ]; then \
		echo "$(YELLOW)❌ VALUE is required for non-interactive mode$(NC)"; \
		echo "$(BLUE)💡 Usage: make add-env-var KEY=VAR_NAME VALUE=var_value [ENV=development|preview|production]$(NC)"; \
		echo "$(BLUE)   Examples:$(NC)"; \
		echo "$(BLUE)     # Add to all environments:$(NC)"; \
		echo "$(BLUE)     make add-env-var KEY=FIRECRAWL_API_KEY VALUE=fc-...$(NC)"; \
		echo "$(BLUE)     # Add to specific environment:$(NC)"; \
		echo "$(BLUE)     make add-env-var KEY=OPENAI_API_KEY ENV=production VALUE=sk-...$(NC)"; \
		exit 1; \
	fi
	@if [ -n "$(ENV)" ]; then \
		echo "$(BLUE)   Adding $(KEY) to $(ENV) environment...$(NC)"; \
		echo "$(VALUE)" | vercel env add $(KEY) $(ENV) --force; \
	else \
		echo "$(BLUE)   Running interactive mode to add $(KEY) to all environments...$(NC)"; \
		echo "$(BLUE)   You'll be prompted to:$(NC)"; \
		echo "$(BLUE)     1. Enter value: $(VALUE)$(NC)"; \
		echo "$(BLUE)     2. Select all environments (Production, Preview, Development)$(NC)"; \
		echo "$(BLUE)     3. Mark as sensitive? (choose 'n' or 'y')$(NC)"; \
		echo ""; \
		vercel env add $(KEY) --force; \
	fi
	@echo "$(GREEN)✅ Environment variable added to Vercel project$(NC)"
	@echo "$(BLUE)💡 To pull updated variables to local: make pull-vercel-env$(NC)"

# Neon CLI Commands
neon-setup: ## Setup Neon CLI authentication
	@echo "$(BLUE)🔐 Setting up Neon CLI...$(NC)"
	@if ! command -v neonctl >/dev/null 2>&1; then \
		echo "$(YELLOW)❌ Neon CLI not found$(NC)"; \
		echo "$(YELLOW)   Install with: npm install -g neonctl$(NC)"; \
		echo "$(YELLOW)   Or: brew install neonctl$(NC)"; \
		exit 1; \
	fi
	@neonctl auth
	@echo "$(GREEN)✅ Neon CLI authenticated$(NC)"

neon-branch-preview-create: ## Create preview branch from main (for local dev and preview deployments)
	@echo "$(BLUE)🌿 Creating preview branch from main...$(NC)"
	@if ! command -v neonctl >/dev/null 2>&1; then \
		echo "$(YELLOW)❌ Neon CLI not found. Run: make neon-setup$(NC)"; \
		exit 1; \
	fi
	@if [ -z "$(NEON_PROJECT_ID)" ]; then \
		echo "$(YELLOW)⚠️  NEON_PROJECT_ID not set$(NC)"; \
		echo "$(BLUE)💡 Usage: make neon-branch-preview-create NEON_PROJECT_ID=your-project-id$(NC)"; \
		echo "$(BLUE)   Or set it: export NEON_PROJECT_ID=your-project-id$(NC)"; \
		exit 1; \
	fi
	@neonctl branches create --name preview --parent main --project-id $(NEON_PROJECT_ID) || \
		echo "$(YELLOW)⚠️  Preview branch may already exist$(NC)"
	@echo "$(GREEN)✅ Preview branch created$(NC)"
	@echo "$(BLUE)📋 Next: Get connection strings with: make neon-connection-strings$(NC)"

neon-connection-strings: ## Get connection strings for main and preview branches
	@if [ -z "$(NEON_PROJECT_ID)" ]; then \
		echo "$(YELLOW)⚠️  NEON_PROJECT_ID not set$(NC)"; \
		echo "$(BLUE)💡 Usage: make neon-connection-strings NEON_PROJECT_ID=your-project-id$(NC)"; \
		exit 1; \
	fi
	@echo "$(BLUE)📋 Connection Strings:$(NC)"
	@echo ""
	@echo "$(GREEN)Main (Production):$(NC)"
	@neonctl connection-string main --project-id $(NEON_PROJECT_ID) || true
	@echo ""
	@echo "$(GREEN)Preview (Local Dev & Preview Deployments):$(NC)"
	@neonctl connection-string preview --project-id $(NEON_PROJECT_ID) || true
	@echo ""
	@echo "$(BLUE)💡 Copy these to .env.production and .env.preview files$(NC)"
	@echo "$(BLUE)   Format for .env.preview and .env.production:$(NC)"
	@echo "   FLYWAY_URL=jdbc:postgresql://host:5432/neondb?sslmode=require"
	@echo "   FLYWAY_USER=your_user"
	@echo "   FLYWAY_PASSWORD=your_password"

# Flyway Migration Commands
migrate-preview: ## Run migrations on preview branch
	@echo "$(BLUE)🔄 Running migrations on preview branch...$(NC)"
	@if [ ! -f ".env.preview" ]; then \
		echo "$(YELLOW)❌ .env.preview not found$(NC)"; \
		echo "$(YELLOW)   Create it with connection string from: make neon-connection-strings$(NC)"; \
		exit 1; \
	fi
	@docker run --rm \
		-v $(PWD)/flyway/conf:/flyway/conf \
		-v $(PWD)/flyway/sql:/flyway/sql \
		--env-file .env.preview \
		flyway/flyway:latest migrate -configFiles="/flyway/conf/env_preview.conf"

migrate-production: ## Run migrations on production (main) branch
	@echo "$(YELLOW)⚠️  Running migrations on PRODUCTION (main branch)...$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		if [ ! -f ".env.production" ]; then \
			echo "$(YELLOW)❌ .env.production not found$(NC)"; \
			exit 1; \
		fi; \
		docker run --rm \
			-v $(PWD)/flyway/conf:/flyway/conf \
			-v $(PWD)/flyway/sql:/flyway/sql \
			--env-file .env.production \
			flyway/flyway:latest migrate -configFiles="/flyway/conf/env_production.conf"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

migrate-info: ## Show migration status for preview branch
	@if [ ! -f ".env.preview" ]; then \
		echo "$(YELLOW)❌ .env.preview not found$(NC)"; \
		exit 1; \
	fi
	@docker run --rm \
		-v $(PWD)/flyway/conf:/flyway/conf \
		-v $(PWD)/flyway/sql:/flyway/sql \
		--env-file .env.preview \
		flyway/flyway:latest info -configFiles="/flyway/conf/env_preview.conf"

migrate-subscribers: ## Run migrations for the subscribers database
	@echo "$(BLUE)🔄 Running migrations on subscribers database...$(NC)"
	@if [ ! -f ".env.subscribers" ]; then \
		echo "$(YELLOW)❌ .env.subscribers not found$(NC)"; \
		echo "$(YELLOW)   Create it with: FLYWAY_URL=... FLYWAY_USER=... FLYWAY_PASSWORD=... (pointing at SUBSCRIBERS_DATABASE_URL)$(NC)"; \
		exit 1; \
	fi
	@docker run --rm \
		-v $(PWD)/flyway/conf:/flyway/conf \
		-v $(PWD)/flyway/subscribers_sql:/flyway/subscribers_sql \
		--env-file .env.subscribers \
		flyway/flyway:latest migrate -configFiles="/flyway/conf/env_subscribers.conf"

migrate-subscribers-info: ## Show migration status for the subscribers database
	@if [ ! -f ".env.subscribers" ]; then \
		echo "$(YELLOW)❌ .env.subscribers not found$(NC)"; \
		exit 1; \
	fi
	@docker run --rm \
		-v $(PWD)/flyway/conf:/flyway/conf \
		-v $(PWD)/flyway/subscribers_sql:/flyway/subscribers_sql \
		--env-file .env.subscribers \
		flyway/flyway:latest info -configFiles="/flyway/conf/env_subscribers.conf"

migrate-clean: ## Clean migration history (use with caution! Development only)
	@echo "$(YELLOW)⚠️  This will clean migration history. Use only for development!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		if [ ! -f ".env.preview" ]; then \
			echo "$(YELLOW)❌ .env.preview not found$(NC)"; \
			exit 1; \
		fi; \
		docker run --rm \
			-v $(PWD)/flyway/conf:/flyway/conf \
			-v $(PWD)/flyway/sql:/flyway/sql \
			--env-file .env.preview \
			flyway/flyway:latest clean -configFiles="/flyway/conf/env_preview.conf"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

