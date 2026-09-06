import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

type TelegramWebAppUser = {
  id: number;
};

function getInitData(req: Request): string | null {
  const value = req.header('x-telegram-init-data');
  return value?.trim() || null;
}

export function getTelegramUserId(req: Request): number | null {
  const initData = getInitData(req);
  const botToken = process.env.BOT_TOKEN;
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !Number.isSafeInteger(authDate)) return null;

  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < 0 || age > MAX_INIT_DATA_AGE_SECONDS) return null;

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  const expectedHash = createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const receivedBuffer = Buffer.from(receivedHash, 'hex');
  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return null;
  }

  try {
    const user = JSON.parse(params.get('user') || '{}') as TelegramWebAppUser;
    return Number.isSafeInteger(user.id) && user.id > 0 ? user.id : null;
  } catch {
    return null;
  }
}
