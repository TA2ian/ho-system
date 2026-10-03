# Production Deployment

This document defines the repository-side production deployment contract for the HO Network API on a VPS.

## Components

- PostgreSQL 17 is private to the Docker network and is not published on the host.
- The API container is private to the Docker network and exposes port 3000 only to Caddy.
- Caddy terminates HTTPS and reverse-proxies the API.
- The web application can remain on Firebase Hosting; set CORS_ORIGIN to its exact HTTPS origin.
- Container images are published to GHCR by CI.

## Required production inputs

Create an untracked production environment file on the VPS. At minimum:

    API_IMAGE=ghcr.io/ta2ian/ho-system:latest
    API_DOMAIN=api.example.com
    CORS_ORIGIN=https://app.example.com
    POSTGRES_PASSWORD=<long-random-secret>
    DATABASE_URL=postgresql://ho:<url-encoded-password>@postgres:5432/ho_network

Do not commit production secrets.

The PostgreSQL password must be generated independently and URL-encoded before embedding in DATABASE_URL when it contains reserved URI characters.

## Deployment

From the repository checkout on the VPS:

    docker compose --env-file .env.production -f deploy/docker-compose.production.yml config
    docker compose --env-file .env.production -f deploy/docker-compose.production.yml pull
    docker compose --env-file .env.production -f deploy/docker-compose.production.yml up -d
    docker compose --env-file .env.production -f deploy/docker-compose.production.yml ps

The API image starts by running the production migration command before starting the server. Database migrations are guarded by the existing migration runner and advisory lock.

DNS for API_DOMAIN must point to the VPS before first HTTPS access. Caddy obtains and renews the certificate automatically.

## Firewall

Only publish TCP 80 and 443 to the internet. SSH should be restricted according to the VPS provider's access policy. PostgreSQL port 5432 and API port 3000 must not be exposed publicly.

## Backups

Use scripts/backup.sh from a controlled maintenance environment with DATABASE_URL set. Store dumps outside the application container and restrict permissions.

A backup is not considered operationally complete until:

1. The dump succeeds.
2. The dump is copied to independent storage.
3. Restore is periodically exercised against a disposable PostgreSQL instance.
4. The restored database passes npm run db:verify.

The repository CI performs a PostgreSQL 17 dump/restore round-trip as a regression check; this does not replace off-host backups or disaster-recovery exercises.

## Monitoring

The API exposes:

- /health: process health without a database dependency.
- /ready: readiness including PostgreSQL connectivity.

The production API container healthcheck uses /ready. External monitoring should check the HTTPS endpoint and alert on non-2xx readiness responses.

Do not expose /ready publicly through a separate unauthenticated management port.

## Authentication gate

The repository contains a provider-neutral AuthenticationAdapter and an intentionally unconfigured adapter. The production stack must not be treated as authenticated until a real identity provider adapter is configured and its issuer/signature/audience/expiry validation and identity-to-user mapping are verified.

This is an intentional security gate, not a deployment workaround.

## Release flow

1. CI validates typecheck, tests, build, audit, database migrations, and backup/restore.
2. CI builds and publishes an immutable container tag to GHCR.
3. The VPS pulls the selected immutable tag.
4. docker compose ... up -d replaces the API container.
5. Verify /ready, application logs, and database migration state.
6. Keep the previous image tag available for rollback.

Prefer immutable commit-SHA image tags for production. Do not rely on latest for rollback.

## Rollback

Set API_IMAGE to the previous known-good immutable image tag and run:

    docker compose --env-file .env.production -f deploy/docker-compose.production.yml up -d api

Database migrations are forward-only in the current repository contract. A rollback of application code must therefore be compatible with the already-applied schema; destructive schema rollback is not part of the automated procedure.
