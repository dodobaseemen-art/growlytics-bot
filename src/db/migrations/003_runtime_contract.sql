-- Complete runtime columns used by the bot and admin authorization.
-- Additive and safe to run more than once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_is_admin_idx
  ON users (is_admin)
  WHERE is_admin = TRUE;

-- After applying this migration, mark the owner explicitly if needed:
-- UPDATE users SET is_admin = TRUE WHERE telegram_id = <ADMIN_TELEGRAM_ID>;
