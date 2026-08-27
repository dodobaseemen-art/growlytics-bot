import { Router, raw } from 'express';
import { handleWebhookEvent, stripe } from '../utils/stripe';

const router = Router();

router.post('/stripe', raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    );
    await handleWebhookEvent(event);
    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

export default router;