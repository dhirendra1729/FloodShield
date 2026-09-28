#!/bin/bash
# run_pipeline.sh
set -e

echo -e "\e[36m=========================================\e[0m"
echo -e "\e[36m    FloodShield Pipeline Automation      \e[0m"
echo -e "\e[36m=========================================\e[0m"

# 1. Database Initialization
echo -e "\n\e[33m[Phase 1] Initializing Database...\e[0m"
./setup_db.sh

# 2. Run Python Scripts
echo -e "\n\e[33m[Phase 2] Running Data Ingestion...\e[0m"
if [ -f ".venv/bin/python" ]; then
    PYTHON_BIN=".venv/bin/python"
elif [ -f "venv/bin/python" ]; then
    PYTHON_BIN="venv/bin/python"
else
    echo -e "\e[31mERROR: Virtual environment not found (checked .venv and venv). Please create it first.\e[0m"
    exit 1
fi

$PYTHON_BIN src/data_pipeline.py

echo -e "\n\e[33m[Phase 3] Running Simulation...\e[0m"
$PYTHON_BIN src/hydraulic.py

echo -e "\n\e[32m=========================================\e[0m"
echo -e "\e[32m       Pipeline Execution Complete!      \e[0m"
echo -e "\e[32m=========================================\e[0m"
