.PHONY: dev start stop build lint lint-fix knip test test-unit test-e2e clean db-reset db-migrate install hooks-install hooks-uninstall help

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

#===============================================================================
# Development
#===============================================================================

## dev: Start development servers (client + server concurrently)
dev:
	@echo "$(CYAN)Starting development servers...$(NC)"
	npm run dev

## dev-client: Start only the client development server
dev-client:
	@echo "$(CYAN)Starting client development server...$(NC)"
	npm run dev:client

## dev-server: Start only the server development server
dev-server:
	@echo "$(CYAN)Starting server development server...$(NC)"
	npm run dev:server

#===============================================================================
# Production
#===============================================================================

## build: Build all packages for production
build:
	@echo "$(CYAN)Building for production...$(NC)"
	npm run build

## start: Start the production server
start:
	@echo "$(GREEN)Starting production server...$(NC)"
	npm run start

## stop: Stop running CC Orchestrator processes
stop:
	@echo "$(YELLOW)Stopping CC Orchestrator processes...$(NC)"
	@pkill -f "node.*cc-hard-core" 2>/dev/null || echo "No processes found"
	@pkill -f "tsx.*cc-hard-core" 2>/dev/null || echo "No tsx processes found"
	@echo "$(GREEN)Done$(NC)"

#===============================================================================
# Code Quality
#===============================================================================

## lint: Run ESLint on all packages
lint:
	@echo "$(CYAN)Running ESLint...$(NC)"
	npm run lint

## lint-fix: Run ESLint and auto-fix issues
lint-fix:
	@echo "$(CYAN)Running ESLint with auto-fix...$(NC)"
	npm run lint:fix

## knip: Check for unused dependencies, exports, and files
knip:
	@echo "$(CYAN)Running Knip...$(NC)"
	npm run knip

## format: Format code with Prettier (if configured)
format:
	@echo "$(CYAN)Formatting code...$(NC)"
	@npx prettier --write "**/*.{ts,tsx,js,jsx,json,css,md}" 2>/dev/null || echo "Prettier not configured"

#===============================================================================
# Testing
#===============================================================================

## test: Run all tests
test:
	@echo "$(CYAN)Running all tests...$(NC)"
	npm run test

## test-unit: Run unit tests only
test-unit:
	@echo "$(CYAN)Running unit tests...$(NC)"
	npm run test:unit

## test-e2e: Run end-to-end tests
test-e2e:
	@echo "$(CYAN)Running E2E tests...$(NC)"
	npm run test:e2e

## test-e2e-claude: Run E2E tests with real Claude Code integration
test-e2e-claude:
	@echo "$(CYAN)Running Claude integration tests...$(NC)"
	@echo "$(YELLOW)Note: Requires Claude CLI installed and hooks configured$(NC)"
	npm run test:e2e:claude --workspace=client

## test-watch: Run tests in watch mode
test-watch:
	@echo "$(CYAN)Running tests in watch mode...$(NC)"
	npm run test:watch --workspace=server

#===============================================================================
# Database
#===============================================================================

## db-migrate: Run database migrations
db-migrate:
	@echo "$(CYAN)Running database migrations...$(NC)"
	npm run db:migrate

## db-reset: Reset the database (delete and recreate)
db-reset:
	@echo "$(YELLOW)Resetting database...$(NC)"
	npm run db:reset --workspace=server

## db-backup: Backup the database
db-backup:
	@echo "$(CYAN)Backing up database...$(NC)"
	@mkdir -p backups
	@cp server/data/orchestrator.db backups/orchestrator-$$(date +%Y%m%d-%H%M%S).db 2>/dev/null || echo "No database to backup"
	@echo "$(GREEN)Backup complete$(NC)"

#===============================================================================
# Setup & Cleanup
#===============================================================================

## install: Install all dependencies
install:
	@echo "$(CYAN)Installing dependencies...$(NC)"
	npm install

## clean: Remove all build artifacts and dependencies
clean:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf node_modules
	rm -rf client/node_modules client/dist
	rm -rf server/node_modules server/dist
	rm -rf shared/node_modules shared/dist
	@echo "$(GREEN)Clean complete$(NC)"

## clean-build: Remove only build artifacts (keep node_modules)
clean-build:
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf client/dist server/dist shared/dist
	@echo "$(GREEN)Clean complete$(NC)"

## reset: Full reset - clean everything and reinstall
reset: clean install db-reset
	@echo "$(GREEN)Full reset complete$(NC)"

#===============================================================================
# Claude Code Hooks
#===============================================================================

## hooks-install: Install Claude Code hooks for status tracking
hooks-install:
	@echo "$(CYAN)Installing Claude Code hooks...$(NC)"
	@node scripts/install-hooks.js
	@echo "$(GREEN)Hooks installed$(NC)"

## hooks-uninstall: Remove Claude Code hooks
hooks-uninstall:
	@echo "$(YELLOW)Removing Claude Code hooks...$(NC)"
	@node scripts/uninstall-hooks.js
	@echo "$(GREEN)Hooks removed$(NC)"

## hooks-check: Check if hooks are installed
hooks-check:
	@echo "$(CYAN)Checking Claude Code hooks...$(NC)"
	@node scripts/check-hooks.js

#===============================================================================
# Docker (optional)
#===============================================================================

## docker-build: Build Docker image
docker-build:
	@echo "$(CYAN)Building Docker image...$(NC)"
	docker build -t cc-orchestrator .

## docker-run: Run Docker container
docker-run:
	@echo "$(GREEN)Running Docker container...$(NC)"
	docker run -p 3456:3456 -v ~/.claude:/root/.claude:ro cc-orchestrator

## docker-stop: Stop Docker container
docker-stop:
	@echo "$(YELLOW)Stopping Docker container...$(NC)"
	docker stop $$(docker ps -q --filter ancestor=cc-orchestrator) 2>/dev/null || true

#===============================================================================
# Utilities
#===============================================================================

## logs: Tail server logs (if logging to file)
logs:
	@tail -f server/logs/*.log 2>/dev/null || echo "No log files found"

## status: Show status of running processes
status:
	@echo "$(CYAN)CC Orchestrator Status$(NC)"
	@echo "========================"
	@pgrep -fl "cc-hard-core" 2>/dev/null || echo "No running processes"
	@echo ""
	@echo "Database:"
	@ls -la server/data/orchestrator.db 2>/dev/null || echo "  Not created yet"

## health: Check server health
health:
	@curl -s http://localhost:3456/api/health | jq . 2>/dev/null || echo "Server not running"

#===============================================================================
# Help
#===============================================================================

## help: Show this help message
help:
	@echo "$(CYAN)CC Orchestrator - Make Commands$(NC)"
	@echo "================================="
	@echo ""
	@grep -E '^##' Makefile | sed 's/## //' | column -t -s ':'
	@echo ""
	@echo "Usage: make [target]"
