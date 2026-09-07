# Growlytics Bot v2.0

Telegram Community Analytics with Stripe, AI & Webhooks.

## Features
- 🤖 Telegram Bot (Webhook mode)
- 📊 Mini App (mobile-first)
- ⚙️ Admin Dashboard
- 💳 Stripe Payments (Subscriptions)
- 🤖 OpenAI Analytics (Sentiment + Growth Tips)
- 🎁 Referral System
- 🗄️ PostgreSQL
- 📈 Daily unique active users, peak hour, and engagement metrics

The stats API now returns `activeUsers`, `peakHour`, and `engagement` per group and in the aggregate analytics object. Engagement is defined as `messages / activeUsers`, rounded to two decimal places.

## Setup
1. Fill `.env` with your keys
2. Run `src/db/schema.sql` on PostgreSQL for a new database. For an existing database, run `src/db/migrations/001_message_events_and_analytics_metrics.sql`, then `002_billing_schema.sql`, then `003_runtime_contract.sql`.
3. Set `APP_TIMEZONE` to an IANA timezone such as `Africa/Cairo` or `UTC` so `peak_hour` uses the intended local time.
4. Set strong random values for `WEBHOOK_SECRET` and `ADMIN_API_TOKEN`; both are required when the server starts or when the admin endpoint is used.
5. `npm ci && npm run build && npm start`
6. Run `npm test` to build the project and verify the analytics and billing contracts.

## Render Deploy
- Build: `npm install && npm run build`
- Start: `node dist/bot.js`
- Set WEB_APP_URL for webhook mode
