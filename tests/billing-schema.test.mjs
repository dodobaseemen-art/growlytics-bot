import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
const migration = await readFile(
  new URL('../src/db/migrations/002_billing_schema.sql', import.meta.url),
  'utf8'
);
const stripe = await readFile(new URL('../src/utils/stripe.ts', import.meta.url), 'utf8');

for (const [name, sql] of [
  ['bootstrap schema', schema],
  ['billing migration', migration]
]) {
  test(`${name} defines the billing contract`, () => {
    for (const token of [
      'stripe_customer_id',
      'stripe_subscription_id',
      'CREATE TABLE IF NOT EXISTS payments',
      'CREATE TABLE IF NOT EXISTS usage_logs',
      'CREATE TABLE IF NOT EXISTS ai_insights',
      "provider IN ('stripe', 'telegram_stars')"
    ]) {
      assert.match(sql, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  });
}

test('Stripe payment records resolve the internal users.id from telegram_id', () => {
  assert.match(
    stripe,
    /INSERT INTO payments[\s\S]*SELECT id FROM users WHERE telegram_id = \$1/i
  );
  assert.match(
    stripe,
    /INSERT INTO usage_logs[\s\S]*SELECT id FROM users WHERE telegram_id = \$1/i
  );
});
