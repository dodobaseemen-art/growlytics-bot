const tokenKey = 'growlytics_admin_token';

function getAdminToken() {
  const existing = sessionStorage.getItem(tokenKey);
  if (existing) return existing;

  const token = window.prompt('Enter the Growlytics admin token:');
  if (token) sessionStorage.setItem(tokenKey, token);
  return token;
}

async function loadAdminStats() {
  try {
    const token = getAdminToken();
    if (!token) return;

    const res = await fetch('/api/admin/stats', {
      headers: { 'X-Admin-Token': token }
    });

    if (res.status === 401) {
      sessionStorage.removeItem(tokenKey);
      throw new Error('Invalid admin token');
    }

    if (!res.ok) throw new Error(`Admin request failed: ${res.status}`);

    const data = await res.json();
    document.getElementById('totalUsers').textContent = data.totalUsers;
    document.getElementById('dau').textContent = data.dau;
    document.getElementById('paidUsers').textContent = data.paidUsers;
    document.getElementById('revenue').textContent = '$' + data.totalRevenue.toFixed(2);
    document.getElementById('mrr').textContent = '$' + data.mrr.toFixed(2);

    const conversion = data.totalUsers > 0
      ? ((data.paidUsers / data.totalUsers) * 100).toFixed(1)
      : 0;
    document.getElementById('conversion').textContent = conversion + '%';
  } catch (e) {
    console.error('Admin load error:', e);
  }
}

loadAdminStats();
setInterval(loadAdminStats, 30000);
