CREATE TABLE exposure_rollups (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 day date NOT NULL,
 exposure_count bigint NOT NULL CHECK(exposure_count>=0),
 qualified_count bigint NOT NULL CHECK(qualified_count>=0),
 visible_ms bigint NOT NULL CHECK(visible_ms>=0),
 PRIMARY KEY(user_id,day)
);
CREATE INDEX exposures_retention_idx ON exposures(created_at);
