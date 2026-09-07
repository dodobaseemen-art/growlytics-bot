CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_premium BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    plan VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    referral_code VARCHAR(20) UNIQUE,
    referred_by BIGINT REFERENCES users(telegram_id),
    credits INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS users_stripe_customer_id_idx
    ON users (stripe_customer_id);

CREATE INDEX IF NOT EXISTS users_stripe_subscription_id_idx
    ON users (stripe_subscription_id);

CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    telegram_group_id BIGINT UNIQUE NOT NULL,
    group_name VARCHAR(255),
    added_by BIGINT REFERENCES users(telegram_id),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    plan VARCHAR(20) DEFAULT 'free',
    expires_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    group_id BIGINT REFERENCES groups(telegram_group_id),
    date DATE DEFAULT CURRENT_DATE,
    messages_count INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    peak_hour INTEGER CHECK (peak_hour IS NULL OR peak_hour BETWEEN 0 AND 23),
    new_members INTEGER DEFAULT 0,
    left_members INTEGER DEFAULT 0,
    UNIQUE(group_id, date)
);

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

CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id BIGINT REFERENCES users(telegram_id),
    referred_id BIGINT REFERENCES users(telegram_id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    converted_at TIMESTAMP,
    UNIQUE(referrer_id, referred_id)
);

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
