#!/bin/bash
# setup_db.sh
# Automates the creation of the FloodShield database using Docker Compose.

set -e # Exit on error

echo -e "\e[36m=========================================\e[0m"
echo -e "\e[36m   FloodShield Database Initialization   \e[0m"
echo -e "\e[36m=========================================\e[0m"
echo ""

DB_NAME="floodshield_db"
DB_USER="floodshield_user"
DB_PASS="floodshield_pass"

if command -v docker &> /dev/null && command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo " -> Docker detected. Starting PostGIS database container..."
    if docker compose up -d 2>/dev/null || docker-compose up -d 2>/dev/null; then
        echo " -> Waiting for database to be ready..."
        sleep 5
        echo " -> Enabling PostGIS extension..."
        # We try until it succeeds since DB might be starting up
        for i in {1..5}; do
            if docker exec floodshield_db_container psql -U floodshield_user -d floodshield_db -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>/dev/null; then
                break
            fi
            sleep 2
        done
        echo -e "\e[32m✅ Database Setup Complete via Docker!\e[0m"
        echo "The PostGIS spatial database is now running on port 5434."
        exit 0
    fi
fi

echo " -> Docker unavailable or failed. Falling back to local PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo -e "\e[31mERROR: Neither Docker nor local 'psql' command found.\e[0m"
    echo "Please ensure Docker or PostgreSQL with PostGIS is installed on your system."
    echo "Ubuntu/Debian: sudo apt install postgresql postgis"
    echo "macOS: brew install postgresql postgis"
    exit 1
fi

echo -e "\e[33mSetting up local database (may prompt for sudo password)...\e[0m"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS postgis;" || {
    echo -e "\e[31mERROR: Failed to create postgis extension. Ensure PostGIS is installed.\e[0m"
    exit 1
}

echo ""
echo -e "\e[32m✅ Local Database Setup Complete!\e[0m"
echo "The PostGIS spatial database is now running on local default port (5432)."
