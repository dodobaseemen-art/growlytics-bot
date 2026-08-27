import { Router } from 'express';
import { createCheckoutSession } from '../utils/stripe';

const router = Router();

router.post('/create-checkout', async (req, res) => {
  try {
    const { userId, plan, successUrl, cancelUrl } = req.body;
    if (!userId || !plan) return res.status(400).json({ error: 'Missing params' });
    
    const session = await createCheckoutSession(userId, plan, successUrl, cancelUrl);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Payment creation failed' });
  }
});

export default router;