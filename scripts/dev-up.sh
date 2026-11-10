#!/usr/bin/env bash
# Starts the database, waits until it is ready, then starts the backend on port 8081.
set -e
cd "$(dirname "$0")/.."

if curl -s -o /dev/null http://localhost:8081/actuator/health; then
  echo "The backend is already running on port 8081."
  echo "To load code changes into it, run: cd backend && ./mvnw -o -q compile"
  echo "The running app restarts itself. To start fresh, press Ctrl+C in its terminal first."
  exit 0
fi

docker compose up -d
echo "Waiting for the database..."
until docker exec stockflow-db pg_isready -U stockflow -d stockflow > /dev/null 2>&1; do
  sleep 1
done
echo "Database is ready. Starting the backend on port 8081..."
cd backend
./mvnw -o spring-boot:run
