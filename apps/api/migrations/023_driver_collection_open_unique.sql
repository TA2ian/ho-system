CREATE UNIQUE INDEX driver_collection_open_driver_uq
ON driver_collection_sessions (driver_user_id)
WHERE status = 'open';
