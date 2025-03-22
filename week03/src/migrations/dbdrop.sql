-- Drop tables in the correct order for dependencies
DROP TABLE IF EXISTS outbox;
DROP TABLE IF EXISTS inbox;
DROP TABLE IF EXISTS followers;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS check_ins;
DROP TABLE IF EXISTS places;
DROP TABLE IF EXISTS actors;
DROP TABLE IF EXISTS users; 