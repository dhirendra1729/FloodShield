#!/usr/bin/env bash
# ==============================================================================
# FloodShield - Dam Break Hydrodynamic Modeling System (SIH26161 NTRO)
# Single startup runner for both FastAPI backend and Next.js frontend
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Colors for terminal output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}           FloodShield — Hydrodynamic Dam Break Suite                ${NC}"
echo -e "${CYAN}       Problem Statement: SIH26161 | Sponsoring Org: NTRO           ${NC}"
echo -e "${CYAN}====================================================================${NC}"

# 1. Locate Python Environment
if [ -f "$BACKEND_DIR/.venv/bin/python" ]; then
    PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
elif [ -f "$BACKEND_DIR/venv/bin/python" ]; then
    PYTHON_BIN="$BACKEND_DIR/venv/bin/python"
else
    PYTHON_BIN="python3"
    echo -e "${YELLOW}No backend virtualenv found; falling back to $PYTHON_BIN.${NC}"
    echo -e "${YELLOW}ANUGA will not import unless it is installed in that interpreter.${NC}"
    echo -e "${YELLOW}Create one with: python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt${NC}"
fi

echo -e "${GREEN}[1/3] Using Python environment:${NC} $PYTHON_BIN"

# Check if node_modules exists
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}[2/3] Installing frontend dependencies...${NC}"
    npm --prefix "$FRONTEND_DIR" install
fi

# Cleanup handler for graceful shutdown
cleanup() {
    echo -e "\n${YELLOW}Shutting down FloodShield services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    # Also free ports 8000 and 3000 if occupied
    fuser -k 8000/tcp 2>/dev/null || true
    fuser -k 3000/tcp 2>/dev/null || true
    echo -e "${GREEN}All services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Free ports if previously left hanging
fuser -k 8000/tcp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true

# 2. Launch FastAPI Backend
echo -e "${GREEN}[2/3] Starting FastAPI Hydrodynamic Backend on port 8000...${NC}"
cd "$BACKEND_DIR"
$PYTHON_BIN -m uvicorn src.main:app --port 8000 --host 0.0.0.0 &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

# Wait for backend to be ready
echo -e "${CYAN}Waiting for backend health check...${NC}"
RETRIES=20
READY=0
while [ $RETRIES -gt 0 ]; do
    if curl -s http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 0.5
    RETRIES=$((RETRIES-1))
done

if [ $READY -eq 1 ]; then
    echo -e "${GREEN} Backend is READY at http://127.0.0.1:8000${NC}"
else
    echo -e "${YELLOW} Backend is still starting up, proceeding with frontend...${NC}"
fi

# 3. Launch Next.js Frontend
echo -e "${GREEN}[3/3] Starting Next.js Mission Control Dashboard on port 3000...${NC}"
echo -e ""
echo -e "${CYAN}--------------------------------------------------------------------${NC}"
echo -e "${GREEN}  FloodShield Dashboard: ${NC}http://localhost:3000"
echo -e "${GREEN}  Interactive API Docs:  ${NC}http://localhost:8000/docs"
echo -e "${GREEN}  Health Status Check:   ${NC}http://localhost:8000/api/health"
echo -e "${CYAN}--------------------------------------------------------------------${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop all services.${NC}"
echo -e ""

npm --prefix "$FRONTEND_DIR" run dev
