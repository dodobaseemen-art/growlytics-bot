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
    credits INTEGER DEFAULT 0
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
    new_members INTEGER DEFAULT 0,
    left_members INTEGER DEFAULT 0,
    UNIQUE(group_id, date)
);

CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id BIGINT REFERENCES users(telegram_id),
    referred_id BIGINT REFERENCES users(telegram_id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    converted_at TIMESTAMP
);