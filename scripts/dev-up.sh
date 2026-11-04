#!/usr/bin/env bash
# Starts the database, waits until it is ready, then starts the backend on port 8081.
set -e
cd "$(dirname "$0")/.."
docker compose up -d
echo "Waiting for the database..."
until docker exec stockflow-db pg_isready -U stockflow -d stockflow > /dev/null 2>&1; do
  sleep 1
done
echo "Database is ready. Starting the backend on port 8081..."
cd backend
./mvnw -o spring-boot:run
