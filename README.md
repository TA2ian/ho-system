# HO Network System

Internal Arabic-first accounting and management system.

## Architecture

- Frontend: React + Vite + TypeScript
- Backend: Node.js + TypeScript
- API: Fastify
- Database: PostgreSQL
- Validation: Zod
- Authentication/authorization: isolated application boundary
- Deployment: Docker on VPS
- UI: Arabic-first, RTL, PWA

## Principles

1. Financial records are immutable by default.
2. State-changing operations are transactional.
3. Financial operations are idempotent.
4. Authorization is enforced server-side.
5. Every sensitive state change is auditable.
6. Domain rules do not depend on HTTP or database implementation details.
7. Production and staging data are strictly separated.

See `docs/architecture.md` and `docs/roadmap.md`.
