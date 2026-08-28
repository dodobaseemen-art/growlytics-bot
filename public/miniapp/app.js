const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;

async function loadStats() {
  if (!user) return;

  try {
    const res = await fetch(`/api/stats/${user.id}`);
    const data = await res.json();

    document.getElementById('credits').textContent =
      data.user?.credits || 0;

    document.getElementById('groups').textContent =
      data.groups?.length || 0;

   document.getElementById('referrals').textContent =
  data.referrals?.converted || 0;

document.getElementById('messages').textContent =
  data.analytics?.messages || 0;

    const plan = data.user?.plan || 'free';
    const badge = document.getElementById('plan-badge');

    badge.textContent = plan.toUpperCase();
    badge.className = `badge ${plan}`;

    const refLink =
      `https://t.me/GrowlyticsBot?start=${data.user?.referral_code || ''}`;

    document.getElementById('ref-link').value = refLink;

    if (data.groups?.length > 0) {
      loadAIInsights(data.groups[0].telegram_group_id);
    }
  } catch (e) {
    console.error('Load error:', e);
  }
}

async function loadAIInsights(groupId) {
  try {
    const res = await fetch(`/api/ai/insights/${groupId}`);
    const data = await res.json();

    document.getElementById('ai-insight').textContent =
      data.insight || 'No data yet.';

    const tipsContainer = document.getElementById('ai-tips');
    tipsContainer.innerHTML = '';

    (data.tips || []).forEach(tip => {
      const div = document.createElement('div');

      div.className = 'tip';
      div.textContent = `💡 ${tip}`;

      tipsContainer.appendChild(div);
    });
  } catch (e) {
    console.error('AI load error:', e);
  }
}

async function selectPlan(plan) {
  if (!user) {
    tg.showAlert('Please open Growlytics from Telegram.');
    return;
  }

  tg.HapticFeedback.impactOccurred('light');

  try {
    const res = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: user.id,
        plan,
        successUrl:
          `${window.location.origin}/miniapp?success=1`,
        cancelUrl:
          `${window.location.origin}/miniapp?canceled=1`
      })
    });

    const data = await res.json();

    if (data.url) {
      tg.openLink(data.url);
    } else {
      tg.showAlert('Payment setup failed. Try again.');
    }
  } catch (e) {
    tg.showAlert('Error: ' + e.message);
  }
}

function copyRef() {
  const input = document.getElementById('ref-link');

  input.select();
  input.setSelectionRange(0, 99999);

  document.execCommand('copy');

  tg.HapticFeedback.notificationOccurred('success');
  tg.showAlert('Link copied!');
}

function showSection(section, clickedElement) {
  document
    .querySelectorAll('.bottom-nav a')
    .forEach(a => a.classList.remove('active'));

  if (clickedElement) {
    clickedElement.classList.add('active');
  }

  if (section === 'stats') {
    document
      .querySelector('.stats-grid')
      .scrollIntoView({ behavior: 'smooth' });
  }

  if (section === 'upgrade') {
    document
      .querySelector('.plans')
      .scrollIntoView({ behavior: 'smooth' });
  }

  if (section === 'referral') {
    document
      .querySelector('.referral-box')
      .scrollIntoView({ behavior: 'smooth' });
  }
}

loadStats();