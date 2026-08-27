import pool from '../db/pool';

export function generateReferralCode(telegramId: number): string {
  return `REF${telegramId.toString(36).toUpperCase()}`;
}

export async function createReferral(
  referrerId: number,
  referredId: number
): Promise<void> {
  if (referrerId === referredId) return;

  await pool.query(
    `INSERT INTO referrals (referrer_id, referred_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [referrerId, referredId]
  );
}

export async function markReferralConverted(
  referredId: number
): Promise<void> {
  await pool.query(
    `UPDATE referrals
     SET status = 'converted',
         converted_at = NOW()
     WHERE referred_id = $1
       AND status = 'pending'`,
    [referredId]
  );
}

export async function getReferralCount(
  referrerId: number
): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*) AS count
     FROM referrals
     WHERE referrer_id = $1
       AND status = 'converted'`,
    [referrerId]
  );

  return parseInt(result.rows[0]?.count || '0', 10);
}

export async function getReferralStats(
  referrerId: number
): Promise<{
  total: number;
  converted: number;
  pending: number;
}> {
  const result = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'converted') AS converted,
       COUNT(*) FILTER (WHERE status = 'pending') AS pending
     FROM referrals
     WHERE referrer_id = $1`,
    [referrerId]
  );

  const row = result.rows[0];

  return {
    total: parseInt(row?.total || '0', 10),
    converted: parseInt(row?.converted || '0', 10),
    pending: parseInt(row?.pending || '0', 10)
  };
}

export async function addReferralReward(
  userId: number,
  credits: number = 5
): Promise<void> {
  await pool.query(
    `UPDATE users
     SET credits = credits + $1
     WHERE telegram_id = $2`,
    [credits, userId]
  );
}