# NodeX Deployment Makefile

.PHONY: help build up down logs dev prod clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all containers
	docker-compose build

up: ## Start all services in production mode
	docker-compose up -d

down: ## Stop all services
	docker-compose down

logs: ## Show logs from all services
	docker-compose logs -f

dev: ## Start services in development mode
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

prod: ## Start services in production mode (detached)
	docker-compose up -d

clean: ## Clean up volumes and containers
	docker-compose down -v

restart: ## Restart all services
	docker-compose restart

status: ## Show status of all services
	docker-compose ps

env-setup: ## Copy example env file
	cp .env.example .env
	@echo "Please edit .env file with your configuration"