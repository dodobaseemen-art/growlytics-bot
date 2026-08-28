async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    document.getElementById('totalUsers').textContent = data.totalUsers;
    document.getElementById('dau').textContent = data.dau;
    document.getElementById('paidUsers').textContent = data.paidUsers;
    document.getElementById('revenue').textContent = '$' + data.totalRevenue.toFixed(2);
    document.getElementById('mrr').textContent = '$' + data.mrr.toFixed(2);
    
    const conversion = data.totalUsers > 0 ? ((data.paidUsers / data.totalUsers) * 100).toFixed(1) : 0;
    document.getElementById('conversion').textContent = conversion + '%';
  } catch (e) {
    console.error('Admin load error:', e);
  }
}

loadAdminStats();
setInterval(loadAdminStats, 30000);