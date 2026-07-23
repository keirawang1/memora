ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_media_types text[] NOT NULL DEFAULT '{}';
