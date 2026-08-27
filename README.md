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

## Setup
1. Fill `.env` with your keys
2. Run `src/db/schema.sql` on PostgreSQL
3. `npm install && npm run build && npm start`

## Render Deploy
- Build: `npm install && npm run build`
- Start: `node dist/bot.js`
- Set WEB_APP_URL for webhook mode
