-- Restrict the publication join before loading/ranking candidate versions.
CREATE INDEX posts_published_version_idx ON posts(current_published_version_id)
  WHERE status='published';
-- Optional editorial filters are evaluated before count and pagination.
CREATE INDEX post_versions_topic_level_format_idx ON post_versions
  ((content->>'topic'),(content->>'difficulty'),(content->>'format'));
