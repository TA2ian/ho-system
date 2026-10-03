# Persistence Foundation

The persistence layer is PostgreSQL-first and provider-independent.

## Database access

The API uses a PostgreSQL connection pool through `pg`, with Drizzle ORM providing typed SQL composition. The database URL is supplied only through environment configuration.

Production database credentials must never be committed to the repository. Local Docker defaults are development-only.

## Migrations

Schema changes are explicit SQL files under `apps/api/migrations`.

The migration runner:
- discovers migrations in lexical order;
- acquires a PostgreSQL advisory lock so only one process migrates at a time;
- applies each migration inside a transaction;
- stores a SHA-256 checksum;
- refuses to continue if an already-applied migration was modified.

Production deployment should execute migrations as a controlled deployment step before exposing the new application version.

## Money and currencies

Financial arithmetic must not use JavaScript `Number`.

The application uses `Decimal` for monetary arithmetic and PostgreSQL `numeric` for persisted financial values. Currency is explicit on every multi-currency financial record.

The initial currency registry contains USD and SYP because those are the business currencies currently required. Currency metadata remains data-driven so additional currencies can be introduced without changing the accounting model.

Exchange rates are stored separately from monetary amounts and include their source and observation timestamp. This allows manual rates and externally sourced rates to coexist without silently changing historical transactions.

## Audit and idempotency

Audit events are append-only at the database level. Update/delete operations are rejected by a database trigger.

Idempotency records are scoped by operation context and key. A request hash is stored so the same key cannot be reused for a different payload.

The application layer will own the complete idempotency lifecycle when the first state-changing commands are implemented.
