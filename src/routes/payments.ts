import { Router } from 'express';
import { createCheckoutSession } from '../utils/stripe';
import { getTelegramUserId } from '../utils/telegram-auth';

const router = Router();

function safeRedirect(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;

  try {
    const requested = new URL(value);
    const configured = process.env.WEB_APP_URL
      ? new URL(process.env.WEB_APP_URL)
      : null;

    if (configured && requested.origin === configured.origin) {
      return requested.toString();
    }
  } catch {
    // Invalid or external URLs use the safe fallback.
  }

  return fallback;
}

router.post('/create-checkout', async (req, res) => {
  try {
    const authenticatedUserId = getTelegramUserId(req);
    const { userId, plan } = req.body as {
      userId?: number;
      plan?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!authenticatedUserId || Number(userId) !== authenticatedUserId) {
      return res.status(401).json({ error: 'Telegram authentication required' });
    }

    if (plan !== 'pro' && plan !== 'business') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const appUrl = process.env.WEB_APP_URL || 'http://localhost:3000';
    const session = await createCheckoutSession(
      authenticatedUserId,
      plan,
      safeRedirect(req.body.successUrl, `${appUrl}/miniapp?success=1`),
      safeRedirect(req.body.cancelUrl, `${appUrl}/miniapp?canceled=1`)
    );

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Payment creation failed' });
  }
});

export default router;
