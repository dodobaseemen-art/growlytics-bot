import type { Bot } from 'grammy';

export type StarsPlan = 'pro' | 'business';

const PLANS: Record<
  StarsPlan,
  {
    title: string;
    description: string;
    stars: number;
  }
> = {
  pro: {
    title: 'Growlytics Pro',
    description:
      '5 groups, AI insights and advanced statistics for 30 days.',
    stars: 250
  },

  business: {
    title: 'Growlytics Business',
    description:
      'Unlimited groups, full analytics and API access for 30 days.',
    stars: 750
  }
};

export function getStarsPrice(
  plan: StarsPlan
): number {
  return PLANS[plan].stars;
}

export async function createStarsInvoice(
  bot: Bot,
  userId: number,
  plan: StarsPlan
): Promise<string> {
  const selectedPlan = PLANS[plan];

  if (!selectedPlan) {
    throw new Error(`Invalid Stars plan: ${plan}`);
  }

  const payload = JSON.stringify({
    userId,
    plan,
    provider: 'telegram_stars'
  });

  const invoiceLink =
    await bot.api.createInvoiceLink(
      selectedPlan.title,
      selectedPlan.description,
      payload,
      '',
      'XTR',
      [
        {
          label: selectedPlan.title,
          amount: selectedPlan.stars
        }
      ],
      {}
    );

  return invoiceLink;
}