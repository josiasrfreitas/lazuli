-- Hatchet Lite needs its own database alongside the Lazuli app database.
-- Runs once, on first Postgres container init (empty data volume).
CREATE DATABASE hatchet;
