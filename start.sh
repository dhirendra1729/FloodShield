#!/usr/bin/env bash
# ==============================================================================
# FloodShield - Dam Break Hydrodynamic Modeling System (SIH26161 NTRO)
# Single startup runner for both FastAPI backend and Next.js frontend
# ==============================================================================

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

# Release a port without destroying work in progress.
#
# `fuser -k` sends SIGKILL, severing every open connection at once. If a
# browser tab has a solve in flight the backend dies mid-request, and the Next
# proxy reports "socket hang up" -- a confusing failure, because the backend is
# healthy again a second later once the replacement is up. SIGTERM first:
# uvicorn shuts down gracefully on it and lets the running solve finish.
free_port() {
    local port="$1"
    local limit="${2:-30}"

    fuser "$port/tcp" >/dev/null 2>&1 || return 0

    echo -e "${YELLOW}Port $port is held; asking the old process to finish...${NC}"
    fuser -k -TERM "$port/tcp" 2>/dev/null || true

    local waited=0
    while [ "$waited" -lt "$limit" ]; do
        fuser "$port/tcp" >/dev/null 2>&1 || return 0
        sleep 1
        waited=$((waited + 1))
    done

    echo -e "${YELLOW}Port $port still held after ${limit}s; forcing it.${NC}"
    fuser -k -KILL "$port/tcp" 2>/dev/null || true
    return 0
}

# Cleanup handler for graceful shutdown
cleanup() {
    echo -e "\n${YELLOW}Shutting down FloodShield services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    # Shorter waits here: an explicit shutdown is intentional, so do not hold
    # the terminal for a solve the user has already asked to abandon.
    free_port 8000 10
    free_port 3000 5
    echo -e "${GREEN}All services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Free ports if a previous run was left behind.
# Waits rather than kills, so restarting while a solve is running does not
# throw that solve away.
free_port 8000
free_port 3000

# 2. Launch FastAPI Backend
# No --reload: it runs a second watcher process, and every reload discards the
# in-memory flume benchmark, forcing a re-solve mid-demo. Restart to pick up
# backend changes.
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

cd "$FRONTEND_DIR"
npm run dev
