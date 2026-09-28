# setup_db.ps1
# Automates the creation of the FloodShield database, user, and PostGIS extension.

$ErrorActionPreference = "Stop"

$DB_NAME = "floodshield_db"
$DB_USER = "floodshield_user"
$DB_PASS = "floodshield_pass"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   FloodShield Database Initialization   " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Automatically find psql.exe even if it's not in the Windows PATH
$psql_cmd = "psql"
if (-not (Get-Command "psql" -ErrorAction SilentlyContinue)) {
    Write-Host "Searching for PostgreSQL installation..."
    $found_psql = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Recurse -Filter "psql.exe" -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "pgAdmin" } | Select-Object -First 1 -ExpandProperty FullName
    
    if ($found_psql) {
        $psql_cmd = $found_psql
        Write-Host "Found psql automatically at: $psql_cmd" -ForegroundColor Green
    } else {
        Write-Host "ERROR: 'psql' command not found." -ForegroundColor Red
        Write-Host "Please ensure PostgreSQL is installed."
        exit 1
    }
}

Write-Host "Please enter the password for your 'postgres' superuser account when prompted." -ForegroundColor Yellow
Write-Host ""

try {
    # 1. Create the user (Ignore error if user already exists)
    Write-Host " -> Creating user '$DB_USER'..."
    & $psql_cmd -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>$null
    
    # 2. Create the database
    Write-Host " -> Creating database '$DB_NAME'..."
    & $psql_cmd -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>$null

    # 3. Enable PostGIS extension
    Write-Host " -> Enabling PostGIS extension inside '$DB_NAME'..."
    & $psql_cmd -U postgres -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS postgis;"
    
    Write-Host ""
    Write-Host "✅ Database Setup Complete!" -ForegroundColor Green
    Write-Host "The PostGIS spatial database is now ready for the FloodShield pipeline."
} catch {
    Write-Host ""
    Write-Host "❌ An error occurred during database setup." -ForegroundColor Red
    Write-Host $_.Exception.Message
}
