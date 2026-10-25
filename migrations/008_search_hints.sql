-- Typo matching is restricted to short editorial descriptors. Exact normalized
-- matching and both full-text vectors still index the complete body and code.
ALTER TABLE post_versions ADD COLUMN search_hints text GENERATED ALWAYS AS (
  lower(coalesce(content->>'title','') || ' ' ||
    coalesce((content->'tags')::text,'') || ' ' ||
    coalesce((content->'searchAliases')::text,'') || ' ' ||
    coalesce(content->>'conceptKey','') || ' ' ||
    coalesce(content->>'topic','') || ' ' ||
    coalesce(content->'context'->>'technology','') || ' ' ||
    coalesce(content->'context'->>'version',''))
) STORED;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_trgm') THEN
    CREATE INDEX post_versions_hints_trigram_idx ON post_versions USING gin(search_hints gin_trgm_ops);
  END IF;
END $$;
