.PHONY: help dev stop status setup-docker-env setup-check logs docker-down restart clean build pull-vercel-env

# Default target
.DEFAULT_GOAL := help

# Variables
BACKEND_PORT := 3000
DB_PORT := 5432

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

setup-docker-env: ## Ensure .env.local exists with correct DATABASE_URL for Neon Local
	@echo "$(BLUE)🔧 Setting up Docker environment file...$(NC)"
	@if [ ! -f ".env.local" ]; then \
		echo "$(YELLOW)⚠️  .env.local not found. Creating minimal .env.local...$(NC)"; \
		echo "DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify" > .env.local; \
		echo "$(GREEN)✅ Created .env.local with DATABASE_URL$(NC)"; \
	else \
		echo "$(GREEN)✅ .env.local exists$(NC)"; \
		if grep -q "^DATABASE_URL=" .env.local; then \
			sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify|' .env.local; \
			echo "$(GREEN)   Updated DATABASE_URL for Neon Local$(NC)"; \
		else \
			echo "DATABASE_URL=postgresql://neon:npg@neon-local:5432/neondb?sslmode=no-verify" >> .env.local; \
			echo "$(GREEN)   Added DATABASE_URL for Neon Local$(NC)"; \
		fi; \
	fi
	@echo "$(GREEN)✅ Docker environment file ready!$(NC)"
	@echo "$(BLUE)   File: .env.local$(NC)"

dev: setup-docker-env ## Start backend and Neon Local database with Docker Compose
	@echo "$(BLUE)🐳 Starting services with Docker Compose + Neon Local...$(NC)"
	@echo "$(GREEN)Backend will run on: http://localhost:$(BACKEND_PORT)$(NC)"
	@echo "$(GREEN)Database will run on: localhost:$(DB_PORT)$(NC)"
	@echo "$(GREEN)Using Neon Local (connects to Neon cloud database)$(NC)"
	@echo ""
	@docker-compose --profile dev up -d backend neon-local

stop: ## Stop all running Docker Compose services
	@echo "$(BLUE)🛑 Stopping Docker Compose services...$(NC)"
	@docker-compose --profile dev down 2>/dev/null && echo "$(GREEN)✅ Stopped Docker Compose services$(NC)" || echo "$(YELLOW)⚠️  No Docker Compose services running$(NC)"

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

logs: ## Show Docker Compose logs
	@echo "$(BLUE)📋 Docker Compose Logs$(NC)"
	@echo ""
	@echo "$(GREEN)To view all logs:$(NC)"
	@echo "  docker-compose --profile dev logs -f"
	@echo ""
	@echo "$(GREEN)To view specific service logs:$(NC)"
	@echo "  docker-compose --profile dev logs -f backend"
	@echo "  docker-compose --profile dev logs -f neon-local"
	@echo ""
	@echo "$(GREEN)To check API responses:$(NC)"
	@echo "  Health check:  curl http://localhost:$(BACKEND_PORT)/health"
	@echo "  Web Search:     curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/web-search -H 'Content-Type: application/json' -d '{\"query\":\"test\"}'"
	@echo "  Comparison:     curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/comparison -H 'Content-Type: application/json' -d '{\"items\":[\"item1\",\"item2\"]}'"
	@echo "  Recommendation: curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/recommendation -H 'Content-Type: application/json' -d '{\"context\":\"test\"}'"
	@echo "  Newsletter:     curl -X POST http://localhost:$(BACKEND_PORT)/api/agents/newsletter -H 'Content-Type: application/json' -d '{\"topics\":[\"topic1\"]}'"

docker-down: ## Stop all Docker services and remove containers
	@echo "$(BLUE)🛑 Stopping Docker services...$(NC)"
	@docker-compose --profile dev down

clean: ## Remove containers, volumes, and built images
	@echo "$(BLUE)🧹 Cleaning up Docker resources...$(NC)"
	@docker-compose --profile dev down -v --rmi local 2>/dev/null || true
	@echo "$(GREEN)✅ Cleanup complete$(NC)"

build: ## Build Docker images without starting services
	@echo "$(BLUE)🔨 Building Docker images...$(NC)"
	@docker-compose --profile dev build

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

