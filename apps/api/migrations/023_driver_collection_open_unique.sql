DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM driver_collection_sessions
    WHERE status = 'open'
    GROUP BY driver_user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one open collection session per driver: duplicate open sessions exist';
  END IF;
END $$;

CREATE UNIQUE INDEX driver_collection_open_driver_uq
ON driver_collection_sessions (driver_user_id)
WHERE status = 'open';
