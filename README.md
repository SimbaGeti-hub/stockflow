# StockFlow

Inventory and sales management platform for small and medium businesses.

Built with Java, Spring Boot, PostgreSQL, React, and TypeScript.

## Status

Phase 1: planning, design, and project setup.

## Structure

- `backend/` Spring Boot REST API
- `frontend/` React and TypeScript web app
- `docs/` requirements, wireframes, and database design
- `docker-compose.yml` local PostgreSQL database

## Run locally

1. Start the database: `docker compose up -d`
2. Start the backend (port 8081): `cd backend && ./mvnw spring-boot:run`
3. Start the frontend: `cd frontend && npm run dev`
