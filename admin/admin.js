const API = '/api';
let token = localStorage.getItem('adminToken');
let currentPage = 'dashboard';

// API Helper
async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...headers, headers, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Hata oluştu');
  return data;
}

function api(path) { return apiRequest(path); }
function apiPost(path, body) {
  return apiRequest(path, { method: 'POST', body: JSON.stringify(body) });
}
function apiPut(path, body) {
  return apiRequest(path, { method: 'PUT', body: JSON.stringify(body) });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    checkAuth();
  }

  // Login form
  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;

    try {
      const data = await apiPost('/auth/login', { email, password });
      if (data.user.role !== 'admin') {
        throw new Error('Admin yetkisi gerekli');
      }
      token = data.accessToken;
      localStorage.setItem('adminToken', token);
      showAdminPanel(data.user);
    } catch (err) {
      document.getElementById('admin-login-error').textContent = err.message;
    }
  });

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      loadPage(page);
    });
  });
});

async function checkAuth() {
  try {
    const data = await api('/auth/me');
    if (data.user.role !== 'admin') throw new Error('Not admin');
    showAdminPanel(data.user);
  } catch {
    token = null;
    localStorage.removeItem('adminToken');
  }
}

function showAdminPanel(user) {
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-pages').classList.remove('hidden');
  document.getElementById('admin-username').textContent = user.username;
  loadPage('dashboard');
}

function logout() {
  token = null;
  localStorage.removeItem('adminToken');
  location.reload();
}

// ============ Page Loading ============
async function loadPage(page) {
  currentPage = page;
  const content = document.getElementById('page-content');
  const titles = {
    dashboard: 'Dashboard',
    players: 'Oyuncu Yönetimi',
    villages: 'Köy Yönetimi',
    clans: 'Klan Yönetimi',
    settings: 'Oyun Ayarları',
    announcements: 'Duyurular',
    logs: 'Savaş Logları'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  try {
    switch (page) {
      case 'dashboard': await loadDashboard(content); break;
      case 'players': await loadPlayers(content); break;
      case 'villages': await loadVillages(content); break;
      case 'clans': await loadClans(content); break;
      case 'settings': await loadSettings(content); break;
      case 'announcements': loadAnnouncements(content); break;
      case 'logs': await loadLogs(content); break;
    }
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">Hata: ${err.message}</p>`;
  }
}

// ============ Dashboard ============
async function loadDashboard(el) {
  const data = await api('/admin/dashboard');
  const s = data.stats;

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Toplam Oyuncu</div>
        <div class="value">${s.playerCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Çevrimiçi</div>
        <div class="value" style="color:var(--success)">${s.onlinePlayers}</div>
      </div>
      <div class="stat-card">
        <div class="label">Toplam Köy</div>
        <div class="value">${s.villageCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Klan Sayısı</div>
        <div class="value">${s.clanCount}</div>
      </div>
      <div class="stat-card">
        <div class="label">Aktif Komutlar</div>
        <div class="value" style="color:var(--info)">${s.activeCommands}</div>
      </div>
      <div class="stat-card">
        <div class="label">Son 24s Savaş</div>
        <div class="value" style="color:var(--danger)">${s.recentBattles}</div>
      </div>
    </div>

    <h3 style="margin-bottom:16px;font-size:16px">Top 10 Oyuncu</h3>
    <table class="data-table">
      <thead><tr><th>#</th><th>Oyuncu</th><th>Puan</th><th>ODA</th></tr></thead>
      <tbody>
        ${data.topPlayers.map((p, i) => `
          <tr>
            <td style="color:${i < 3 ? 'var(--accent)' : 'var(--text-dim)'};font-weight:600">${i + 1}</td>
            <td>${p.username}</td>
            <td style="font-weight:600">${p.points}</td>
            <td>${p.offensivePoints}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h3 style="margin:24px 0 12px;font-size:16px">Oyun Ayarları</h3>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Dünya Hızı</div>
        <div class="value">${data.gameSettings.worldSpeed}x</div>
      </div>
      <div class="stat-card">
        <div class="label">Birim Hızı</div>
        <div class="value">${data.gameSettings.unitSpeed}x</div>
      </div>
      <div class="stat-card">
        <div class="label">Dünya Boyutu</div>
        <div class="value">${data.gameSettings.worldSize}x${data.gameSettings.worldSize}</div>
      </div>
    </div>
  `;
}

// ============ Players ============
async function loadPlayers(el, page = 1, search = '') {
  const query = search ? `?page=${page}&search=${search}` : `?page=${page}`;
  const data = await api(`/admin/players${query}`);

  el.innerHTML = `
    <div class="search-bar">
      <input type="text" id="player-search" placeholder="Oyuncu ara..." value="${search}">
      <button class="btn-sm info" onclick="searchPlayers()">Ara</button>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>Kullanıcı</th><th>Email</th><th>Rol</th>
          <th>Puan</th><th>Köy</th><th>Durum</th><th>İşlemler</th>
        </tr>
      </thead>
      <tbody>
        ${data.players.map(p => `
          <tr>
            <td><strong>${p.username}</strong></td>
            <td style="color:var(--text-dim)">${p.email}</td>
            <td><span class="badge ${p.role}">${p.role}</span></td>
            <td>${p.points}</td>
            <td>${p.villages?.length || 0}</td>
            <td>${p.isBanned ? '<span class="badge banned">Banlı</span>' : '<span class="badge online">Aktif</span>'}</td>
            <td>
              <button class="btn-sm ${p.isBanned ? 'success' : 'danger'}"
                onclick="toggleBan('${p._id}', ${!p.isBanned})">
                ${p.isBanned ? 'Unban' : 'Ban'}
              </button>
              <button class="btn-sm secondary" onclick="giveResources('${p._id}')">Kaynak Ver</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${renderPagination(data.page, data.pages, 'loadPlayersPage')}
  `;
}

window.searchPlayers = () => {
  const search = document.getElementById('player-search').value;
  loadPlayers(document.getElementById('page-content'), 1, search);
};

window.loadPlayersPage = (page) => {
  const search = document.getElementById('player-search')?.value || '';
  loadPlayers(document.getElementById('page-content'), page, search);
};

window.toggleBan = async (userId, ban) => {
  try {
    await apiPut(`/admin/players/${userId}`, {
      isBanned: ban,
      banReason: ban ? prompt('Ban sebebi:') || '' : ''
    });
    loadPlayers(document.getElementById('page-content'));
  } catch (err) {
    alert(err.message);
  }
};

window.giveResources = async (userId) => {
  const amount = parseInt(prompt('Kaynak miktarı (her biri):'));
  if (!amount || amount <= 0) return;
  try {
    await apiPut(`/admin/players/${userId}`, {
      addResources: { wood: amount, clay: amount, iron: amount }
    });
    alert('Kaynaklar eklendi!');
  } catch (err) {
    alert(err.message);
  }
};

// ============ Villages ============
async function loadVillages(el, page = 1) {
  const data = await api(`/admin/villages?page=${page}`);

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Köy</th><th>Sahip</th><th>Koordinat</th><th>Puan</th><th>Tip</th></tr>
      </thead>
      <tbody>
        ${data.villages.map(v => `
          <tr>
            <td><strong>${v.name}</strong></td>
            <td>${v.owner?.username || '<span style="color:var(--text-dim)">Barbar</span>'}</td>
            <td>${v.x}|${v.y}</td>
            <td>${v.points}</td>
            <td>${v.isBarbarian ? '<span class="badge player">Barbar</span>' : '<span class="badge online">Oyuncu</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${renderPagination(page, Math.ceil(data.total / 25), 'loadVillagesPage')}
  `;
}

window.loadVillagesPage = (page) => {
  loadVillages(document.getElementById('page-content'), page);
};

// ============ Clans ============
async function loadClans(el) {
  const data = await api('/clans');

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Klan</th><th>Etiket</th><th>Lider</th><th>Üye</th><th>Puan</th></tr>
      </thead>
      <tbody>
        ${data.clans.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td><span class="badge admin">${c.tag}</span></td>
            <td>${c.leader?.username || '?'}</td>
            <td>${c.members?.length || 0}</td>
            <td>${c.points}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ============ Settings ============
async function loadSettings(el) {
  const data = await api('/admin/dashboard');
  const gs = data.gameSettings;

  el.innerHTML = `
    <div class="form-grid">
      <div class="form-group">
        <label>Dünya Hızı</label>
        <input type="number" id="set-worldSpeed" value="${gs.worldSpeed}" step="0.1" min="0.1">
      </div>
      <div class="form-group">
        <label>Birim Hızı</label>
        <input type="number" id="set-unitSpeed" value="${gs.unitSpeed}" step="0.1" min="0.1">
      </div>
      <div class="form-group">
        <label>Maks. Bina Kuyruğu</label>
        <input type="number" id="set-maxBuildQueue" value="${gs.maxBuildQueue}" min="1" max="10">
      </div>
      <div class="form-group">
        <label>Maks. Asker Kuyruğu</label>
        <input type="number" id="set-maxTroopQueue" value="${gs.maxTroopQueue}" min="1" max="20">
      </div>
    </div>
    <button class="btn-primary" style="width:auto;padding:10px 32px;margin-top:16px"
      onclick="saveSettings()">Kaydet</button>
  `;
}

window.saveSettings = async () => {
  try {
    await apiPut('/admin/settings', {
      worldSpeed: parseFloat(document.getElementById('set-worldSpeed').value),
      unitSpeed: parseFloat(document.getElementById('set-unitSpeed').value),
      maxBuildQueue: parseInt(document.getElementById('set-maxBuildQueue').value),
      maxTroopQueue: parseInt(document.getElementById('set-maxTroopQueue').value)
    });
    alert('Ayarlar kaydedildi!');
  } catch (err) {
    alert(err.message);
  }
};

// ============ Announcements ============
function loadAnnouncements(el) {
  el.innerHTML = `
    <div class="announcement-form">
      <h3 style="margin-bottom:16px">Yeni Duyuru</h3>
      <div class="form-group">
        <label>Başlık</label>
        <input type="text" id="announce-title" placeholder="Duyuru başlığı">
      </div>
      <div class="form-group">
        <label>Mesaj</label>
        <textarea id="announce-message" placeholder="Duyuru içeriği..."></textarea>
      </div>
      <button class="btn-primary" style="width:auto;padding:10px 32px"
        onclick="sendAnnouncement()">Yayınla</button>
    </div>
  `;
}

window.sendAnnouncement = async () => {
  const title = document.getElementById('announce-title').value;
  const message = document.getElementById('announce-message').value;
  if (!title || !message) return alert('Başlık ve mesaj gerekli');

  try {
    await apiPost('/admin/announcements', { title, message });
    alert('Duyuru yayınlandı!');
    document.getElementById('announce-title').value = '';
    document.getElementById('announce-message').value = '';
  } catch (err) {
    alert(err.message);
  }
};

// ============ Logs ============
async function loadLogs(el, page = 1) {
  const data = await api(`/admin/logs?page=${page}`);

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr><th>Tarih</th><th>Saldırgan</th><th>Savunan</th><th>Sonuç</th><th>Şans</th></tr>
      </thead>
      <tbody>
        ${data.reports.map(r => `
          <tr>
            <td style="font-size:12px;color:var(--text-dim)">${new Date(r.createdAt).toLocaleString('tr')}</td>
            <td>${r.attacker?.village?.name || '?'}</td>
            <td>${r.defender?.village?.name || '?'}</td>
            <td><span class="badge ${r.winner === 'attacker' ? 'admin' : 'player'}">${r.winner === 'attacker' ? 'Saldırgan' : 'Savunan'}</span></td>
            <td>${r.luck?.toFixed(1) || 0}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${renderPagination(page, Math.ceil(data.total / 25), 'loadLogsPage')}
  `;
}

window.loadLogsPage = (page) => {
  loadLogs(document.getElementById('page-content'), page);
};

// ============ Helpers ============
function renderPagination(current, total, funcName) {
  if (total <= 1) return '';
  let html = '<div class="pagination">';
  for (let i = 1; i <= Math.min(total, 10); i++) {
    html += `<button class="${i === current ? 'active' : ''}" onclick="${funcName}(${i})">${i}</button>`;
  }
  html += '</div>';
  return html;
}
