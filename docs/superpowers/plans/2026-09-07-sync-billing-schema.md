# Growlytics Billing Schema Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchronize the PostgreSQL schema and migration history with the billing queries used by Growlytics so Stripe and Telegram Stars payment flows do not fail on missing columns or tables.

**Architecture:** Add a forward-only, idempotent billing migration for existing installations, and mirror the same billing structures in the bootstrap schema for new installations. Keep application payment logic unchanged unless verification exposes a separate contract mismatch. Add static regression tests that assert the migration defines every billing relation and column referenced by the runtime.

**Tech Stack:** PostgreSQL SQL migrations, TypeScript, Node.js built-in test runner, npm build.

**Spec:** Existing repository behavior and the confirmed failure `column "stripe_customer_id" does not exist`; user-approved scope is safe inspection and code/test changes only, with no deployment, deletion, or external write.

## Global Constraints

- Do not remove data or rewrite existing payment records.
- Use `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` for rerunnable migration safety.
- Preserve Telegram Stars (`XTR`) and Stripe payment records in the same `payments` table.
- Do not commit secrets, `.env`, build output, or dependency changes unless required.
- Do not push, publish, merge, or modify GitHub remotely in this task.

---

### Task 1: Add billing structures to the bootstrap schema

**Files:**
- Modify: `src/db/schema.sql`

- [ ] Add `plan`, `stripe_customer_id`, and `stripe_subscription_id` to `users` with safe defaults and indexes where useful.
- [ ] Add `payments`, `usage_logs`, and `ai_insights` tables matching the existing runtime inserts and reads.
- [ ] Keep constraints compatible with both Stripe USD and Telegram Stars XTR records.

### Task 2: Add an idempotent migration for existing databases

**Files:**
- Create: `src/db/migrations/002_billing_schema.sql`

- [ ] Add missing user billing columns with `IF NOT EXISTS`.
- [ ] Create billing and usage tables with `IF NOT EXISTS`.
- [ ] Add uniqueness for provider payment identifiers only when present, without invalidating historical nulls.

### Task 3: Add regression coverage for schema/runtime contract

**Files:**
- Create: `tests/billing-schema.test.mjs`

- [ ] Read the migration and bootstrap schema as text.
- [ ] Assert the migration includes all required user columns, tables, and payment provider values.
- [ ] Assert the runtime billing references are represented in the schema contract.

### Task 4: Verify and save the change

**Files:**
- No additional source files.

- [ ] Run `npm test`.
- [ ] Run `git diff --check` and inspect the complete diff for secrets and unrelated changes.
- [ ] Commit the atomic fix locally with a descriptive message.
- [ ] Report exact verification evidence and explicitly state that no remote write or deployment occurred.
