CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_premium BOOLEAN DEFAULT FALSE,
    referral_code VARCHAR(20) UNIQUE,
    referred_by BIGINT REFERENCES users(telegram_id),
    credits INTEGER DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    plan VARCHAR(20) DEFAULT 'free',
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255)
);

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
    converted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_active_users (
    id SERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(telegram_group_id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, date, user_id)
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id),
    amount NUMERIC NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    plan VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending',
    provider VARCHAR(50),
    provider_payment_id VARCHAR(255),
    provider_subscription_id VARCHAR(255),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_logs (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT,
    action VARCHAR(255),
    credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id BIGINT,
    details TEXT
);
