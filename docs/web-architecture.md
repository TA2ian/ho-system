# HO Network Web Architecture — foundation/v1

The web application lives in `apps/web` and is intentionally independent from the API runtime.

## Boundaries

- `src/auth/session.ts`: ephemeral authentication session. The bearer token is held in memory only; it is not persisted to Local Storage, IndexedDB, or cookies by the foundation shell.
- `src/api/client.ts`: transport boundary. It attaches the current bearer token and preserves the API error envelope.
- `src/App.tsx`: presentation and navigation only. It does not implement authorization or financial rules.
- `public/sw.js`: offline-safe application shell. It caches only static shell assets and never intentionally caches API responses.
- `public/manifest.webmanifest`: installable Arabic RTL PWA metadata.

## Security constraints

The frontend is not an authorization boundary. Every protected operation remains subject to server authentication, permission checks, and resource ownership.

Financial data is not treated as client-authoritative state. Mutations must use the API's idempotency contract, and posted financial state remains authoritative in PostgreSQL.

The foundation shell does not implement a fake identity provider. It accepts an externally issued bearer token in memory so the concrete production identity provider can be wired later without coupling the UI to a provider.

## Offline behavior

Offline support is limited to loading the application shell. The service worker uses network-first behavior for same-origin GET requests and falls back to the cached shell when unavailable. API responses are not persisted as offline business data.

## Deployment

The build output is `apps/web/dist`. It can be deployed as a static PWA to Firebase Hosting or another static host. `VITE_API_BASE_URL` should point to the deployed API base URL ending at `/api/v1/`.

## Next frontend increments

1. Replace the temporary token-entry surface with the selected production identity provider.
2. Add generated/validated API types from the OpenAPI contract.
3. Implement domain screens incrementally, starting with customers and the operational dashboard.
4. Add browser-level accessibility and responsive regression tests.
