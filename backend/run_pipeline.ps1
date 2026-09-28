# run_pipeline.ps1
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    FloodShield Pipeline Automation     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. Database Initialization
Write-Host "`n[Phase 1] Initializing Database..." -ForegroundColor Yellow
.\setup_db.ps1

# 2. Data Ingestion
Write-Host "`n[Phase 2] Running Data Ingestion..." -ForegroundColor Yellow
if (Test-Path ".\venv\Scripts\python.exe") {
    & .\venv\Scripts\python.exe src/data_pipeline.py
} else {
    Write-Host "ERROR: Virtual environment not found. Please run 'python -m venv venv' and install requirements first." -ForegroundColor Red
    exit 1
}

# 3. Hydraulic Simulation
Write-Host "`n[Phase 3] Running Simulation..." -ForegroundColor Yellow
& .\venv\Scripts\python.exe src/hydraulic.py

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "       Pipeline Execution Complete!     " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
