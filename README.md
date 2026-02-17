# Aileron

Flights API for Aileron website.

## API versioning

Routes are prefixed with `/v1` (e.g. `GET /v1/flights`, `GET /v1/status`). The v1 API may gain new response fields over time; existing fields will not be removed without introducing a new version.

## Prerequisites

- Node.js (v18+)
- Docker and Docker Compose (for running Neo4j and the app in containers)

## Environment variables

| Variable        | Description                    |
| --------------- | ------------------------------ |
| `NEO4J_URI`     | Neo4j Bolt URI (e.g. `bolt://localhost:7687`) |
| `NEO4J_USER`    | Neo4j username                 |
| `NEO4J_PASSWORD`| Neo4j password                 |
| `PORT`          | Server port (default `3000`)   |
| `NODE_ENV`      | `development` or `production` |

## Local run

```bash
npm install
npm run build
```

Create a `.env` file (or export the variables above), then:

```bash
npm start
```

For development with watch mode:

```bash
npm run dev
```

## Docker

Start Neo4j and the app:

```bash
docker-compose up -d
```

Ensure `.env.docker` (or your env file) sets `NEO4J_URI`, `NEO4J_USER`, and `NEO4J_PASSWORD` so the app can connect to the Neo4j service. The compose stack uses `NEO4J_AUTH=neo4j/${NEO4J_PASSWORD:-password123}`, so set `NEO4J_URI=bolt://neo4j:7687`, `NEO4J_USER=neo4j`, and `NEO4J_PASSWORD` to match.

## Seeding the database

Load airports and flights from CSV into Neo4j:

```bash
npm run seed
```

The seed script uses the same env vars as the app. Run it against the same Neo4j instance the app uses (e.g. from the host with `NEO4J_URI=bolt://localhost:7687` when Neo4j is exposed, or from inside a container that can reach the `neo4j` service).
