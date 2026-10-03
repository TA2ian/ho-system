# Backup and Restore

The database backup format is PostgreSQL custom format (`pg_dump --format=custom`).

## Backup

Set `DATABASE_URL` and run:

```bash
bash scripts/backup.sh
```

An explicit output path can be supplied:

```bash
bash scripts/backup.sh ./backups/ho-network-2026-10-03.dump
```

Backup files are created with mode `0600`.

## Restore

Restore is destructive. The script requires an explicit confirmation flag:

```bash
ALLOW_DESTRUCTIVE_RESTORE=YES \
  bash scripts/restore.sh ./backups/ho-network-2026-10-03.dump
```

Production restore requires a second explicit flag:

```bash
ALLOW_DESTRUCTIVE_RESTORE=YES \
ALLOW_PRODUCTION_RESTORE=YES \
NODE_ENV=production \
  bash scripts/restore.sh ./backups/ho-network-2026-10-03.dump
```

After a restore, run the application database verification checks against the restored database before accepting it as a recovery point.

CI independently verifies the backup/restore round trip against a disposable PostgreSQL database.
