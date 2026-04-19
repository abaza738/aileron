# Aileron

Flight search API for the Aileron website. Supports one-way and roundtrip searches with direct and one-stop itineraries, driven by a static CSV timetable loaded into memory at startup — no database required.

## Endpoints

All routes are prefixed with `/api`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/flights` | Search flights |
| `GET` | `/api/status` | Health check |
| `GET` | `/api/docs` | Interactive API documentation (Scalar) |

### Flight search query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `departure_airport` | string | yes | Origin ICAO code (e.g. `NZCH`) |
| `arrival_airport` | string | yes | Destination ICAO code (e.g. `NZQN`) |
| `type` | `one-way` \| `roundtrip` | yes | Trip type |
| `departure_date` | string | yes | ISO date (e.g. `2026-01-12`) |
| `return_date` | string | if roundtrip | ISO date for return leg |

## Prerequisites

- Node.js v18+
- Docker and Docker Compose (for containerised deployment)

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `3000`) |
| `NODE_ENV` | `development` or `production` (default `development`) |
| `HOST` | Host to bind to (default `127.0.0.1`) |
| `DOMAIN` | Public domain name, used by Caddy for TLS (e.g. `api.yourdomain.com`) |

## Local development

```bash
npm install
npm run dev        # tsx watch mode, hot reload
```

## Production build

```bash
npm run build      # compiles TypeScript → dist/ and copies CSV assets
npm start          # runs dist/index.js
```

## Docker (with Caddy reverse proxy)

```bash
DOMAIN=yourdomain.com docker compose up -d
```

Caddy automatically provisions and renews a TLS certificate for `DOMAIN`. No `.env.docker` file is needed unless you want to override `PORT` or `HOST`.

## Deployment

Deployments are triggered by pushing a semver tag. The workflow SSHs into your VPS and checks out that exact tag before rebuilding:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow file is at `.github/workflows/deploy.yml`. Add `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` to your repository secrets (Settings → Secrets).

## Testing

```bash
npm test
```
