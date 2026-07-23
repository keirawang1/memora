-- Distinguish "never chose preferences" from empty skip / DB default '{}'.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_preferences_set boolean NOT NULL DEFAULT false;

-- Existing users who finished (or skipped past) onboarding already have prefs decided.
UPDATE users
SET onboarding_preferences_set = true
WHERE onboarding_completed = true
   OR cardinality(preferred_genres) > 0
   OR cardinality(preferred_media_types) > 0;
