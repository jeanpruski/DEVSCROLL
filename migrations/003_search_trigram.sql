-- Optional: exact identifiers, aliases and FTS continue to work without pg_trgm.
DO $$
BEGIN
 CREATE EXTENSION IF NOT EXISTS pg_trgm;
 CREATE INDEX post_versions_trigram_idx ON post_versions USING gin(search_normalized gin_trgm_ops);
EXCEPTION WHEN insufficient_privilege OR undefined_file THEN
 RAISE NOTICE 'pg_trgm unavailable; lexical search remains enabled';
END $$;
