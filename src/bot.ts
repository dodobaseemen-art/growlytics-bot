import {
  Bot,
  GrammyError,
  HttpError,
  InlineKeyboard,
  webhookCallback
} from 'grammy';
import { Application } from 'express';
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import pool from './db/pool';
import {
  generateReferralCode,
  createReferral,
  getReferralStats,
  addReferralReward
} from './utils/referral';
import {
  analyzeGroupSentiment,
  generateGrowthTips
} from './utils/ai';
import paymentsRouter from './routes/payments';
import { createStarsInvoice } from './utils/stars';
import webhookRouter from './routes/webhook';

dotenv.config();

const bot = new Bot(process.env.BOT_TOKEN || '');
const app: Application = express();

app.use(cors());
app.use(express.json());
app.use('/api/payments', paymentsRouter);
app.use('/webhook', webhookRouter);
app.use(express.static(path.join(__dirname, '../public')));

// ====== TELEGRAM STARS PAYMENT HANDLERS ======

bot.on('pre_checkout_query', async (ctx) => {
  try {
    await ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    console.error('Stars pre-checkout error:', err);
  }
});

bot.on('message:successful_payment', async (ctx) => {
  try {
    const payment = ctx.message.successful_payment;

    const payload = JSON.parse(payment.invoice_payload);
    const userId = Number(payload.userId);
    const plan = payload.plan;

    if (
      !userId ||
      (plan !== 'pro' && plan !== 'business')
    ) {
      console.error('Invalid Stars payment payload:', payment.invoice_payload);
      return;
    }

    const expectedAmount = plan === 'pro' ? 250 : 750;

    if (
      payment.currency !== 'XTR' ||
      payment.total_amount !== expectedAmount
    ) {
      console.error('Invalid Stars payment amount:', payment.total_amount);
      return;
    }

    await pool.query(
      `UPDATE users
       SET plan = $1
       WHERE telegram_id = $2`,
      [plan, userId]
    );

    await pool.query(
      `INSERT INTO payments
       (user_id, amount, currency, plan, status, provider,
        provider_payment_id, paid_at)
       VALUES
       (
         (SELECT id FROM users WHERE telegram_id = $1),
         $2,
         'XTR',
         $3,
         'completed',
         'telegram_stars',
         $4,
         NOW()
       )`,
      [
        userId,
        payment.total_amount,
        plan,
        payment.telegram_payment_charge_id
      ]
    );

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
          provider: 'telegram_stars',
          charge_id: payment.telegram_payment_charge_id
        })
      ]
    );

    await ctx.reply(
      `🎉 Payment successful!\n\n` +
      `💎 Your ${plan.toUpperCase()} plan is now active.\n\n` +
      `⭐ Paid with Telegram Stars.`
    );
  } catch (err) {
    console.error('Stars successful payment error:', err);
  }
});


// ====== BOT COMMANDS ======

bot.command('start', async (ctx) => {
  const user = ctx.from;
  if (!user) return;

  const referralCode = generateReferralCode(user.id);
  const startPayload = ctx.match;

  try {
    await pool.query(
      `INSERT INTO users
       (telegram_id, username, first_name, last_name, referral_code, is_admin)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (telegram_id) DO UPDATE
       SET username = $2, first_name = $3, last_name = $4`,
      [
        user.id,
        user.username,
        user.first_name,
        user.last_name,
        referralCode,
        user.id.toString() === process.env.ADMIN_TELEGRAM_ID
      ]
    );

    if (
      startPayload &&
      startPayload.toString().startsWith('ref')
    ) {
      const refCode = startPayload.toString();

      const referrer = await pool.query(
        `SELECT telegram_id
         FROM users
         WHERE referral_code = $1`,
        [refCode]
      );

      if (referrer.rows.length > 0) {
        await createReferral(
          referrer.rows[0].telegram_id,
          user.id
        );
      }
    }

    const keyboard = new InlineKeyboard()
      .webApp(
        '📊 Open Mini App',
        `${process.env.WEB_APP_URL}/miniapp`
      )
      .row()
      .text('💎 Upgrade', 'show_upgrade')
      .row()
      .text('🎁 Referral', 'referral_stats');

    await ctx.reply(
      `👋 Welcome to *Growlytics*!\\n\\n` +
      `📊 AI-powered community analytics.\\n` +
`🔗 Code: \`${referralCode}\`\n\n` +
      `✨ Free: 1 group · 10 credits\\n` +
      `⭐ Pro: $5/mo → 5 groups + AI insights\\n` +
      `🏢 Business: $15/mo → unlimited + API`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }
    );

    await pool.query(
      `INSERT INTO usage_logs
       (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [
        user.id,
        'start',
        JSON.stringify({
          source: startPayload || 'direct'
        })
      ]
    );
  } catch (err) {
    console.error('Start error:', err);
    await ctx.reply('❌ Error. Try again.');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 *Growlytics*\\n\\n` +
    `/start \\- Dashboard\\n` +
    `/help \\- This menu\\n` +
    `/stats \\- Referrals\\n` +
    `/usage \\- Your usage\\n` +
    `/upgrade \\- Plans\\n` +
    `/ai \\- AI Analysis\\n` +
    `/support \\- Help`,
    {
      parse_mode: 'Markdown'
    }
  );
});

bot.command('stats', async (ctx) => {
  if (!ctx.from) return;

  const stats = await getReferralStats(ctx.from.id);

  const keyboard = new InlineKeyboard()
    .text('📤 Share Link', 'share_referral')
    .row()
    .text('🔙 Back', 'back_start');

  await ctx.reply(
    `🎯 *Your Referrals*\\n\\n` +
    `Total: ${stats.total}\\n` +
    `✅ Converted: ${stats.converted}\\n` +
    `⏳ Pending: ${stats.pending}\\n\\n` +
    `💰 Earn 5 credits per friend!`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
});

bot.command('usage', async (ctx) => {
  if (!ctx.from) return;

  const user = await pool.query(
    `SELECT credits, plan
     FROM users
     WHERE telegram_id = $1`,
    [ctx.from.id]
  );

  const groups = await pool.query(
    `SELECT COUNT(*)
     FROM groups
     WHERE added_by = $1`,
    [ctx.from.id]
  );

  await ctx.reply(
    `📊 *Your Account*\\n\\n` +
    `Plan: ${user.rows[0]?.plan || 'free'}\\n` +
    `Credits: ${user.rows[0]?.credits || 0}\\n` +
    `Groups: ${groups.rows[0].count}\\n\\n` +
    `Open Mini App for full dashboard.`
  );
});

bot.command('upgrade', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text('⭐ Pro $5/mo', 'pay_pro')
    .row()
    .text('🏢 Business $15/mo', 'pay_business')
    .row()
    .text('🔙 Back', 'back_start');

  await ctx.reply(
    `💎 *Choose Your Plan*\\n\\n` +
    `🆓 *Free*\\n1 group · basic stats\\n\\n` +
    `⭐ *Pro* \\- $5/month\\n5 groups · AI insights · advanced stats\\n\\n` +
    `🏢 *Business* \\- $15/month\\nUnlimited · full analytics · API access`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );
});

bot.command('ai', async (ctx) => {
  if (!ctx.from) return;

  await ctx.reply(
    '🤖 Analyzing your groups with AI... (may take a few seconds)'
  );

  const groups = await pool.query(
    `SELECT telegram_group_id
     FROM groups
     WHERE added_by = $1
     LIMIT 1`,
    [ctx.from.id]
  );

  if (groups.rows.length === 0) {
    return ctx.reply('❌ Add me to a group first!');
  }

  const today = new Date()
    .toISOString()
    .split('T')[0];

  const insight = await analyzeGroupSentiment(
    groups.rows[0].telegram_group_id,
    today
  );

  const tips = await generateGrowthTips(
    groups.rows[0].telegram_group_id
  );

  await ctx.reply(
    `🤖 *AI Analysis*\\n\\n` +
    `💡 *Insight:*\\n${insight}\\n\\n` +
    `🚀 *Growth Tips:*\\n` +
    tips
      .map((t: string, i: number) => `${i + 1}. ${t}`)
      .join('\\n'),
    {
      parse_mode: 'Markdown'
    }
  );
});

bot.command('support', async (ctx) => {
  await ctx.reply(
    '📧 support@growlytics.bot\\nWe reply within 24h.'
  );
});

// ====== CALLBACK QUERIES ======

bot.callbackQuery('referral_stats', async (ctx) => {
  if (!ctx.from) return;

  const stats = await getReferralStats(ctx.from.id);
  const refCode = generateReferralCode(ctx.from.id);

  const link = `https://t.me/${ctx.me.username}?start=${refCode}`;

  await ctx.editMessageText(
    `🎯 *Referral Program*\\n\\n` +
    `Total: ${stats.total}\\n` +
    `✅ Converted: ${stats.converted}\\n` +
    `⏳ Pending: ${stats.pending}\\n\\n` +
`🔗 *Your Link:*\n\`${link}\`\n\n` +
    `💰 Earn 5 credits per friend!`,
    {
      parse_mode: 'Markdown'
    }
  );

  await ctx.answerCallbackQuery();
});

bot.callbackQuery('share_referral', async (ctx) => {
  if (!ctx.from) return;

  const refCode = generateReferralCode(ctx.from.id);
  const link = `https://t.me/${ctx.me.username}?start=${refCode}`;

  await ctx.answerCallbackQuery({
    url:
      `https://t.me/share/url?url=` +
      `${encodeURIComponent(link)}` +
      `&text=` +
      `${encodeURIComponent(
        'Join Growlytics - Telegram Analytics Bot!'
      )}`
  });
});

bot.callbackQuery('back_start', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp(
      '📊 Open Mini App',
      `${process.env.WEB_APP_URL}/miniapp`
    )
    .row()
    .text('💎 Upgrade', 'show_upgrade')
    .row()
    .text('🎁 Referral', 'referral_stats');

  await ctx.editMessageText(
    `👋 *Growlytics*\\n\\nAI-powered community analytics.`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );

  await ctx.answerCallbackQuery();
});

bot.callbackQuery('show_upgrade', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text('⭐ Pro $5/mo', 'pay_pro')
    .row()
    .text('🏢 Business $15/mo', 'pay_business')
    .row()
    .text('🔙 Back', 'back_start');

  await ctx.editMessageText(
    `💎 *Choose Your Plan*\\n\\n` +
    `🆓 *Free*\\n1 group · basic stats\\n\\n` +
    `⭐ Pro \\- $5/month\\n5 groups · AI insights · advanced stats\\n\\n` +
    `🏢 Business \\- $15/month\\nUnlimited · full analytics · API access`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    }
  );

  await ctx.answerCallbackQuery();
});

bot.callbackQuery('pay_pro', async (ctx) => {
  if (!ctx.from) return;

  try {
    const invoiceLink = await createStarsInvoice(
      bot,
      ctx.from.id,
      'pro'
    );

    await ctx.reply(
      '⭐ Growlytics Pro\n\n' +
      '250 Telegram Stars / 30 days\n\n' +
      'اضغط الزر بالأسفل لإتمام الدفع:',
      {
        reply_markup: new InlineKeyboard().url(
          '⭐ Pay with Telegram Stars',
          invoiceLink
        )
      }
    );

    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error('Stars Pro payment error:', err);

    await ctx.answerCallbackQuery({
      text: 'Error creating Stars payment.'
    });
  }
});

// ====== ANALYTICS TRACKING ======
bot.callbackQuery('pay_business', async (ctx) => {
  if (!ctx.from) return;

  try {
    const invoiceLink = await createStarsInvoice(
      bot,
      ctx.from.id,
      'business'
    );

    await ctx.reply(
      '🏢 Growlytics Business\n\n' +
      '750 Telegram Stars / 30 days\n\n' +
      'اضغط الزر بالأسفل لإتمام الدفع:',
      {
        reply_markup: new InlineKeyboard().url(
          '⭐ Pay with Telegram Stars',
          invoiceLink
        )
      }
    );

    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error(
      'Stars Business payment error:',
      err
    );

    await ctx.answerCallbackQuery({
      text: 'Error creating Stars payment.'
    });
  }
});
bot.on('message', async (ctx) => {
  if (!ctx.chat || ctx.chat.type === 'private') return;

  try {
    const groupId = ctx.chat.id;
    const userId = ctx.from?.id;

    if (!userId) return;

    const date = new Date()
      .toISOString()
      .split('T')[0];

    // Make sure the group exists
    await pool.query(
      `INSERT INTO groups
       (telegram_group_id, group_name)
       VALUES ($1, $2)
       ON CONFLICT (telegram_group_id)
       DO UPDATE SET group_name = $2`,
      [
        groupId,
        ctx.chat.title || 'Unknown'
      ]
    );

    // Record today's message activity
    await pool.query(
      `INSERT INTO analytics
       (group_id, date, messages_count, active_users)
       VALUES ($1, $2, 1, 1)
       ON CONFLICT (group_id, date)
       DO UPDATE SET
         messages_count =
           analytics.messages_count + 1`,
      [
        groupId,
        date
      ]
    );

  } catch (err) {
    console.error(
      'Analytics error:',
      err
    );
  }
});
// ====== ERROR HANDLING ======

bot.catch((err) => {
  const ctx = err.ctx;

  console.error(
    `Error in update ${ctx.update.update_id}:`
  );

  const e = err.error;

  if (e instanceof GrammyError) {
    console.error(
      'Telegram:',
      e.description
    );
  } else if (e instanceof HttpError) {
    console.error(
      'HTTP:',
      e
    );
  } else {
    console.error(
      'Unknown:',
      e
    );
  }
});

// ====== MINI APP ======

app.get('/miniapp', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ====== EXPRESS API ======

app.get(
  '/api/health',
  (req, res) =>
    res.json({
      status: 'ok',
      time: new Date().toISOString()
    })
);

app.get(
  '/api/stats/:userId',
  async (req, res) => {
    try {
      const userId = parseInt(
        req.params.userId,
        10
      );

      const user = await pool.query(
        `SELECT *
         FROM users
         WHERE telegram_id = $1`,
        [userId]
      );

      const groups = await pool.query(
        `SELECT *
         FROM groups
         WHERE added_by = $1`,
        [userId]
      );

      const referrals =
        await getReferralStats(userId);

      const payments = await pool.query(
        `SELECT *
         FROM payments
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      res.json({
        user: user.rows[0] || null,
        groups: groups.rows,
        referrals,
        payments: payments.rows
      });
    } catch (err) {
      res.status(500).json({
        error: 'Server error'
      });
    }
  }
);

app.get(
  '/api/admin/stats',
  async (req, res) => {
    try {
      const users = await pool.query(
        `SELECT COUNT(*) FROM users`
      );

      const paid = await pool.query(
        `SELECT COUNT(*)
         FROM users
         WHERE plan != 'free'`
      );

      const revenue = await pool.query(
        `SELECT COALESCE(SUM(amount), 0)
         FROM payments
         WHERE status = 'completed'`
      );

      const mrr = await pool.query(
        `SELECT COALESCE(
           SUM(
             CASE
               WHEN plan = 'pro' THEN 5
               WHEN plan = 'business' THEN 15
               ELSE 0
             END
           ),
           0
         )
         FROM users
         WHERE plan != 'free'`
      );

      const dau = await pool.query(
        `SELECT COUNT(DISTINCT user_id)
         FROM usage_logs
         WHERE created_at >=
           NOW() - INTERVAL '24 hours'`
      );

      res.json({
        totalUsers:
          parseInt(users.rows[0].count, 10),

        paidUsers:
          parseInt(paid.rows[0].count, 10),

        totalRevenue:
          parseFloat(revenue.rows[0].coalesce),

        mrr:
          parseFloat(mrr.rows[0].coalesce),

        dau:
          parseInt(dau.rows[0].count, 10)
      });
    } catch (err) {
      res.status(500).json({
        error: 'Server error'
      });
    }
  }
);

app.get(
  '/api/ai/insights/:groupId',
  async (req, res) => {
    try {
      const groupId = parseInt(
        req.params.groupId,
        10
      );

      const today = new Date()
        .toISOString()
        .split('T')[0];

      const insight =
        await analyzeGroupSentiment(
          groupId,
          today
        );

      const tips =
        await generateGrowthTips(
          groupId
        );

      res.json({
        insight,
        tips,
        date: today
      });
    } catch (err) {
      res.status(500).json({
        error: 'AI analysis failed'
      });
    }
  }
);

// ====== WEBHOOK MODE ======

const PORT =
  process.env.PORT || 3000;

const WEBHOOK_PATH =
  `/telegram-webhook/${
    process.env.WEBHOOK_SECRET || 'secret'
  }`;

app.listen(PORT, async () => {
  console.log(
    `🌐 Web server on port ${PORT}`
  );

  if (process.env.WEB_APP_URL) {
    const webhookUrl =
      `${process.env.WEB_APP_URL}${WEBHOOK_PATH}`;

    await bot.api.setWebhook(
      webhookUrl
    );

    console.log(
      `🔗 Webhook set: ${webhookUrl}`
    );

    app.use(
      WEBHOOK_PATH,
      webhookCallback(bot, 'express')
    );
  } else {
    console.log(
      '⚠️ No WEB_APP_URL, using polling mode'
    );

    bot.start();
  }
});

console.log(
  '🚀 Growlytics Bot v2.0 starting...'
);