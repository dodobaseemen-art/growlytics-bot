ALTER TABLE analytics
  ADD COLUMN IF NOT EXISTS peak_hour INTEGER;

ALTER TABLE analytics
  DROP CONSTRAINT IF EXISTS analytics_peak_hour_check;

ALTER TABLE analytics
  ADD CONSTRAINT analytics_peak_hour_check
  CHECK (peak_hour IS NULL OR peak_hour BETWEEN 0 AND 23);

CREATE TABLE IF NOT EXISTS message_events (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES groups(telegram_group_id) ON DELETE CASCADE,
  user_id BIGINT,
  message_id BIGINT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, message_id)
);

CREATE INDEX IF NOT EXISTS message_events_group_sent_at_idx
  ON message_events (group_id, sent_at);

CREATE INDEX IF NOT EXISTS message_events_group_user_sent_at_idx
  ON message_events (group_id, user_id, sent_at);

-- Rebuild daily unique-user and peak-hour values from already captured events.
UPDATE analytics AS a
SET active_users = metrics.active_users,
    peak_hour = metrics.peak_hour
FROM (
  SELECT
    a2.group_id,
    a2.date,
    COUNT(DISTINCT e.user_id)::INTEGER AS active_users,
    (
      SELECT EXTRACT(HOUR FROM e2.sent_at AT TIME ZONE COALESCE(NULLIF(current_setting('app.timezone', true), ''), 'UTC'))::INTEGER
      FROM message_events e2
      WHERE e2.group_id = a2.group_id
        AND e2.sent_at::DATE = a2.date
      GROUP BY EXTRACT(HOUR FROM e2.sent_at AT TIME ZONE COALESCE(NULLIF(current_setting('app.timezone', true), ''), 'UTC'))
      ORDER BY COUNT(*) DESC, EXTRACT(HOUR FROM e2.sent_at AT TIME ZONE COALESCE(NULLIF(current_setting('app.timezone', true), ''), 'UTC'))
      LIMIT 1
    ) AS peak_hour
  FROM analytics a2
  LEFT JOIN message_events e
    ON e.group_id = a2.group_id
   AND e.sent_at::DATE = a2.date
  GROUP BY a2.group_id, a2.date
) AS metrics
WHERE a.group_id = metrics.group_id
  AND a.date = metrics.date;
