-- Synchronize billing and usage storage with the runtime payment queries.
-- This migration is additive and safe to run more than once.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_plan_check;

ALTER TABLE users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'pro', 'business'));

CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx
  ON users (stripe_customer_id);

CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_idx
  ON users (stripe_subscription_id);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL,
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('pro', 'business')),
    status VARCHAR(30) NOT NULL,
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('stripe', 'telegram_stars')),
    provider_payment_id VARCHAR(255),
    provider_subscription_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_payment_id_idx
  ON payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS usage_logs_user_created_at_idx
  ON usage_logs (user_id, created_at);

CREATE TABLE IF NOT EXISTS ai_insights (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(telegram_group_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    insight_type VARCHAR(50) NOT NULL,
    insight_text TEXT NOT NULL,
    confidence NUMERIC(4, 3),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ai_insights_group_date_idx
  ON ai_insights (group_id, date DESC);
