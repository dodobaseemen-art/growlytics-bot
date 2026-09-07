import Stripe from 'stripe';
import dotenv from 'dotenv';
import pool from '../db/pool';

dotenv.config();

const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || '',
  {
    apiVersion: '2024-06-20'
  }
);

export async function createCustomer(
  userId: number,
  email?: string
): Promise<string> {
  const customer = await stripe.customers.create({
    metadata: {
      telegram_id: userId.toString()
    },
    email
  });

  await pool.query(
    `UPDATE users
     SET stripe_customer_id = $1
     WHERE telegram_id = $2`,
    [customer.id, userId]
  );

  return customer.id;
}

export async function createCheckoutSession(
  userId: number,
  plan: 'pro' | 'business',
  successUrl: string,
  cancelUrl: string
) {
  const user = await pool.query(
    `SELECT stripe_customer_id
     FROM users
     WHERE telegram_id = $1`,
    [userId]
  );

  let customerId = user.rows[0]?.stripe_customer_id;

  if (!customerId) {
    customerId = await createCustomer(userId);
  }

  const priceId =
    plan === 'pro'
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_BUSINESS_PRICE_ID;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [
      {
        price: priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      telegram_id: userId.toString(),
      plan
    }
  });

  return session;
}

export async function handleWebhookEvent(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session =
        event.data.object as Stripe.Checkout.Session;

      const userId = parseInt(
        session.metadata?.telegram_id || '0',
        10
      );

      const plan =
        session.metadata?.plan || 'pro';

      await pool.query(
        `UPDATE users
         SET plan = $1,
             stripe_subscription_id = $2
         WHERE telegram_id = $3`,
        [
          plan,
          session.subscription,
          userId
        ]
      );

      const paymentResult = await pool.query(
        `INSERT INTO payments
         (user_id, amount, currency, plan, status, provider,
          provider_payment_id, provider_subscription_id, paid_at)
         VALUES
         (
           (SELECT id FROM users WHERE telegram_id = $1),
           $2,
           'USD',
           $3,
           'completed',
           'stripe',
           $4,
           $5,
           NOW()
         )
         ON CONFLICT (provider, provider_payment_id) DO NOTHING
         RETURNING id`,
        [
          userId,
          plan === 'pro' ? 5 : 15,
          plan,
          session.payment_intent,
          session.subscription
        ]
      );

      if (paymentResult.rowCount === 0) break;

      await pool.query(
        `INSERT INTO usage_logs
         (user_id, action, details)
         VALUES (
           (SELECT id FROM users WHERE telegram_id = $1),
           $2,
           $3
         )`,
        [
          userId,
          'subscription_activated',
          JSON.stringify({
            plan,
            session_id: session.id
          })
        ]
      );

      break;
    }

    case 'invoice.payment_failed': {
      const invoice =
        event.data.object as Stripe.Invoice;

      const customerResponse =
        await stripe.customers.retrieve(
          invoice.customer as string
        );

      if (customerResponse.deleted) {
        break;
      }

      const userId = parseInt(
        customerResponse.metadata?.telegram_id || '0',
        10
      );

      await pool.query(
        `UPDATE users
         SET plan = 'free'
         WHERE telegram_id = $1`,
        [userId]
      );

      break;
    }

    case 'customer.subscription.deleted': {
      const subscription =
        event.data.object as Stripe.Subscription;

      const customerResponse =
        await stripe.customers.retrieve(
          subscription.customer as string
        );

      if (customerResponse.deleted) {
        break;
      }

      const userId = parseInt(
        customerResponse.metadata?.telegram_id || '0',
        10
      );

      await pool.query(
        `UPDATE users
         SET plan = 'free',
             stripe_subscription_id = NULL
         WHERE telegram_id = $1`,
        [userId]
      );

      break;
    }
  }
}

export { stripe };
