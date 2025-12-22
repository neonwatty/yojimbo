# ============================================================================
# CC Orchestrator - Development Commands
# ============================================================================

.PHONY: help install dev build clean test lint format typecheck \
        test-unit test-int test-e2e test-coverage \
        db-migrate db-reset check ci

# Default target
help:
	@echo "CC Orchestrator - Available Commands"
	@echo "======================================"
	@echo ""
	@echo "Development:"
	@echo "  make install        Install all dependencies"
	@echo "  make dev            Start development servers (client + server)"
	@echo "  make dev-client     Start frontend dev server only"
	@echo "  make dev-server     Start backend dev server only"
	@echo "  make build          Build for production"
	@echo "  make clean          Remove build artifacts and node_modules"
	@echo ""
	@echo "Testing:"
	@echo "  make test           Run all tests"
	@echo "  make test-unit      Run unit tests"
	@echo "  make test-int       Run integration tests"
	@echo "  make test-e2e       Run E2E tests"
	@echo "  make test-coverage  Run tests with coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint           Run ESLint"
	@echo "  make lint-fix       Run ESLint with auto-fix"
	@echo "  make format         Run Prettier"
	@echo "  make format-check   Check Prettier formatting"
	@echo "  make typecheck      Run TypeScript type checking"
	@echo "  make knip           Find unused code, deps, and exports"
	@echo "  make check          Run all checks (lint + format + typecheck + knip)"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate     Run database migrations"
	@echo "  make db-reset       Reset database (WARNING: deletes data)"
	@echo ""
	@echo "CI:"
	@echo "  make ci             Run full CI pipeline locally"

# ============================================================================
# Development
# ============================================================================

install:
	pnpm install

dev:
	pnpm dev

dev-client:
	pnpm --filter @cc-orchestrator/client dev

dev-server:
	pnpm --filter @cc-orchestrator/server dev

build:
	pnpm build

clean:
	rm -rf node_modules packages/*/node_modules
	rm -rf packages/*/dist
	rm -rf coverage playwright-report test-results
	rm -rf .turbo

# ============================================================================
# Testing
# ============================================================================

test:
	pnpm test

test-unit:
	pnpm test:unit

test-int:
	pnpm test:int

test-e2e:
	pnpm test:e2e

test-coverage:
	pnpm test:coverage

# ============================================================================
# Code Quality
# ============================================================================

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

format:
	pnpm format

format-check:
	pnpm format:check

typecheck:
	pnpm typecheck

knip:
	pnpm knip

check:
	pnpm check

# ============================================================================
# Database
# ============================================================================

db-migrate:
	pnpm db:migrate

db-reset:
	pnpm db:reset

# ============================================================================
# CI
# ============================================================================

ci: install check test build
	@echo "CI pipeline completed successfully"
