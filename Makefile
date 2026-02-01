.PHONY: help start stop restart build logs logs-backend logs-frontend clean status health shell-backend shell-frontend dev-backend dev-frontend test-api

# Default target
help:
	@echo "GlobeBeats - Development Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Docker Commands:"
	@echo "  start          Start all services (docker-compose up -d)"
	@echo "  stop           Stop all services (docker-compose down)"
	@echo "  restart        Restart all services"
	@echo "  build          Rebuild and start services"
	@echo "  clean          Stop and remove all containers, volumes, images"
	@echo ""
	@echo "Logs:"
	@echo "  logs           Follow logs for all services"
	@echo "  logs-backend   Follow backend logs only"
	@echo "  logs-frontend  Follow frontend logs only"
	@echo ""
	@echo "Status:"
	@echo "  status         Show running containers"
	@echo "  health         Check backend health endpoint"
	@echo ""
	@echo "Development:"
	@echo "  shell-backend  Open shell in backend container"
	@echo "  shell-frontend Open shell in frontend container"
	@echo "  dev-backend    Run backend locally (no Docker)"
	@echo "  dev-frontend   Run frontend locally (no Docker)"
	@echo ""
	@echo "Testing:"
	@echo "  test-api       Test backend API endpoints"
	@echo ""
	@echo "URLs:"
	@echo "  Frontend: http://localhost:5174"
	@echo "  Backend:  http://localhost:8001"
	@echo "  API Docs: http://localhost:8001/docs"

# =============================================================================
# Docker Commands
# =============================================================================

start:
	@echo "Starting GlobeBeats..."
	@if [ ! -f .env ]; then \
		echo "No .env file found. Creating from .env.example..."; \
		cp .env.example .env; \
		echo "Created .env - please edit with your API keys!"; \
	fi
	docker-compose up -d
	@echo ""
	@echo "Services started!"
	@echo "  Frontend: http://localhost:5174"
	@echo "  Backend:  http://localhost:8001"

stop:
	@echo "Stopping GlobeBeats..."
	docker-compose down
	@echo "Services stopped."

restart: stop start

build:
	@echo "Building and starting GlobeBeats..."
	@if [ ! -f .env ]; then \
		echo "No .env file found. Creating from .env.example..."; \
		cp .env.example .env; \
		echo "Created .env - please edit with your API keys!"; \
	fi
	docker-compose up -d --build
	@echo ""
	@echo "Services built and started!"
	@echo "  Frontend: http://localhost:5174"
	@echo "  Backend:  http://localhost:8001"

clean:
	@echo "Cleaning up Docker resources..."
	docker-compose down -v --rmi local --remove-orphans
	@echo "Cleanup complete."

# =============================================================================
# Logs
# =============================================================================

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

# =============================================================================
# Status
# =============================================================================

status:
	@echo "Container Status:"
	@docker-compose ps
	@echo ""
	@echo "Port Bindings:"
	@docker-compose ps --format "table {{.Name}}\t{{.Ports}}"

health:
	@echo "Backend Health Check:"
	@curl -s http://localhost:8001/ | python3 -m json.tool 2>/dev/null || echo "Backend not responding"
	@echo ""
	@echo "RAG Stats:"
	@curl -s http://localhost:8001/rag/stats | python3 -m json.tool 2>/dev/null || echo "Backend not responding"

# =============================================================================
# Development
# =============================================================================

shell-backend:
	docker exec -it globebeats-backend-1 bash

shell-frontend:
	docker exec -it globebeats-frontend-1 sh

dev-backend:
	@echo "Starting backend locally..."
	@echo "Make sure to activate venv and install requirements first!"
	cd backend && uvicorn main:app --reload --port 8001

dev-frontend:
	@echo "Starting frontend locally..."
	@echo "Make sure to run 'npm install' first!"
	cd frontend && npm run dev -- --port 5174

# =============================================================================
# Testing
# =============================================================================

test-api:
	@echo "Testing Backend API..."
	@echo ""
	@echo "1. Health Check:"
	@curl -s http://localhost:8001/ | python3 -m json.tool
	@echo ""
	@echo "2. Countries Count:"
	@curl -s http://localhost:8001/countries | python3 -c "import sys,json; print(f'Loaded {len(json.load(sys.stdin))} countries')"
	@echo ""
	@echo "3. Search Test (Taylor Swift):"
	@curl -s -X POST http://localhost:8001/search \
		-H "Content-Type: application/json" \
		-d '{"query": "Taylor Swift", "limit": 3}' | python3 -m json.tool
	@echo ""
	@echo "API tests complete!"
