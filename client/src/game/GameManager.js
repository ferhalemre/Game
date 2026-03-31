import { api } from '../network/ApiClient.js';
import { socketClient } from '../network/SocketClient.js';
import { VillageScene } from '../scenes/VillageScene.js';
import { WorldMapScene } from '../scenes/WorldMapScene.js';
import { BUILDINGS, UNITS, formatNumber, formatTime, formatTimeUntil, timeAgo } from '../utils/helpers.js';

export class GameManager {
  constructor() {
    this.user = null;
    this.currentVillage = null;
    this.villages = [];
    this.currentView = 'village';
    this.villageScene = null;
    this.mapScene = null;
    this.canvas = document.getElementById('game-canvas');
    this.updateTimers = [];
    this.resourceInterval = null;
  }

  async init(userData) {
    this.user = userData.user;
    this.villages = userData.villages || [];

    if (this.villages.length === 0 && this.user.villages.length > 0) {
      const data = await api.get(`/villages/${this.user.villages[0]}`);
      this.villages = [data.village];
    }

    this.currentVillage = this.villages[0];

    // Socket bağlan
    socketClient.connect(api.accessToken);
    if (this.currentVillage) {
      socketClient.joinVillage(this.currentVillage._id);
    }

    this.setupUI();
    this.setupSocketListeners();
    this.loadVillageView();
    this.startResourceTimer();
  }

  setupUI() {
    // Kullanıcı bilgileri
    document.getElementById('username-display').textContent = this.user.username;
    document.getElementById('player-points').textContent = formatNumber(this.user.points);

    // Köy seçici
    this.updateVillageSelector();

    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.switchView(view);
      });
    });

    // Panel kapatma
    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.panel').classList.add('hidden');
      });
    });

    // Mesaj butonu
    document.getElementById('btn-messages').addEventListener('click', () => {
      this.showMessages();
    });

    this.updateResourceDisplay();
    this.updateQueueDisplay();
  }

  updateVillageSelector() {
    const select = document.getElementById('village-select');
    select.innerHTML = '';
    this.villages.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v._id;
      opt.textContent = `${v.name} (${v.x}|${v.y})`;
      if (v._id === this.currentVillage?._id) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener('change', (e) => this.switchVillage(e.target.value));
  }

  async switchVillage(villageId) {
    if (this.currentVillage) {
      socketClient.leaveVillage(this.currentVillage._id);
    }
    const data = await api.get(`/villages/${villageId}`);
    this.currentVillage = data.village;
    socketClient.joinVillage(villageId);
    this.updateResourceDisplay();
    this.updateQueueDisplay();
    if (this.currentView === 'village' && this.villageScene) {
      this.villageScene.updateBuildings(this.currentVillage.buildings);
    }
  }

  switchView(view) {
    this.currentView = view;
    // Tüm panelleri gizle
    document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden'));

    // Scene değiştir
    if (view === 'village') {
      this.loadVillageView();
    } else if (view === 'map') {
      this.loadMapView();
    } else if (view === 'troops') {
      this.showTroopsPanel();
    } else if (view === 'commands') {
      this.showCommandsPanel();
    } else if (view === 'clan') {
      this.showClanPanel();
    } else if (view === 'market') {
      this.showMarketPanel();
    } else if (view === 'ranking') {
      this.showRankingPanel();
    } else if (view === 'reports') {
      this.showReportsPanel();
    }
  }

  // ============ Village View ============
  loadVillageView() {
    if (this.mapScene) { this.mapScene.stop(); this.mapScene = null; }

    if (!this.villageScene) {
      this.villageScene = new VillageScene(this.canvas);
      this.villageScene.onBuildingClick = (type) => this.showBuildingPanel(type);
      this.villageScene.start();
    }

    if (this.currentVillage) {
      this.villageScene.updateBuildings(this.currentVillage.buildings);
    }
  }

  // ============ Map View ============
  async loadMapView() {
    if (this.villageScene) { this.villageScene.stop(); this.villageScene = null; }

    if (!this.mapScene) {
      this.mapScene = new WorldMapScene(this.canvas);
      this.mapScene.onVillageClick = (data) => this.onMapVillageClick(data);
      this.mapScene.start();
    }

    try {
      const x = this.currentVillage?.x || 250;
      const y = this.currentVillage?.y || 250;
      const data = await api.get(`/map?x=${x}&y=${y}&range=30`);
      this.mapScene.loadVillages(data.villages);
      this.mapScene.centerOn(x, y);
    } catch (err) {
      this.notify('Harita yüklenirken hata: ' + err.message, 'error');
    }
  }

  onMapVillageClick(data) {
    if (data.ownerId === this.user._id) {
      // Kendi köyümüz - geçiş yap
      this.switchVillage(data.villageId);
      this.switchView('village');
      document.querySelector('[data-view="village"]').click();
    } else {
      // Başka köy - saldırı/destek paneli aç
      this.showAttackPanel(data);
    }
  }

  // ============ Building Panel ============
  async showBuildingPanel(type) {
    const panel = document.getElementById('building-panel');
    const building = this.currentVillage.buildings[type];
    const info = BUILDINGS[type];

    document.getElementById('building-name').textContent = info.name;
    document.getElementById('building-level').textContent = `Seviye ${building.level}`;
    document.getElementById('building-desc').textContent = '';

    // Bina bilgileri
    const infoDiv = document.getElementById('building-info');
    infoDiv.innerHTML = `
      <div class="info-item">
        <span class="label">Mevcut Seviye</span>
        <span class="value">${building.level}</span>
      </div>
      <div class="info-item">
        <span class="label">Köy Puanı</span>
        <span class="value">${this.currentVillage.points}</span>
      </div>
    `;

    // Yükseltme butonu
    const btn = document.getElementById('btn-upgrade');
    btn.onclick = () => this.upgradeBuildingAction(type);

    panel.classList.remove('hidden');
  }

  async upgradeBuildingAction(type) {
    try {
      const data = await api.post(`/villages/${this.currentVillage._id}/build`, { building: type });
      this.notify(data.message, 'success');

      // Verileri güncelle
      const villageData = await api.get(`/villages/${this.currentVillage._id}`);
      this.currentVillage = villageData.village;
      this.updateResourceDisplay();
      this.updateQueueDisplay();
      this.showBuildingPanel(type); // Paneli güncelle
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  // ============ Troops Panel ============
  async showTroopsPanel() {
    const panel = document.getElementById('troops-panel');
    const list = document.getElementById('troop-list');
    const queue = document.getElementById('troop-queue');

    // Mevcut birlikleri göster
    let html = '';
    for (const [type, info] of Object.entries(UNITS)) {
      const count = this.currentVillage.troops[type] || 0;
      html += `
        <div class="troop-card">
          <div class="troop-icon">${info.icon}</div>
          <div class="troop-info">
            <div class="troop-name">${info.name}</div>
            <div class="troop-count">Mevcut: ${count}</div>
          </div>
          <div class="troop-recruit">
            <input type="number" min="0" value="0" id="recruit-${type}" placeholder="0">
            <button class="btn btn-sm btn-primary" onclick="window.gameManager.recruitAction('${type}')">Eğit</button>
          </div>
        </div>
      `;
    }
    list.innerHTML = html;

    // Kuyruk
    queue.innerHTML = '';
    if (this.currentVillage.troopQueue?.length > 0) {
      this.currentVillage.troopQueue.forEach(q => {
        const info = UNITS[q.unitType] || { name: q.unitType };
        queue.innerHTML += `
          <div class="command-item support">
            <div>
              <div class="command-type">${info.name} x${q.amount}</div>
              <div class="command-timer">${formatTimeUntil(q.completesAt)}</div>
            </div>
          </div>
        `;
      });
    }

    panel.classList.remove('hidden');
  }

  async recruitAction(unitType) {
    const input = document.getElementById(`recruit-${unitType}`);
    const amount = parseInt(input.value) || 0;
    if (amount <= 0) return;

    try {
      const data = await api.post(`/villages/${this.currentVillage._id}/recruit`, { unitType, amount });
      this.notify(data.message, 'success');
      input.value = '0';

      const villageData = await api.get(`/villages/${this.currentVillage._id}`);
      this.currentVillage = villageData.village;
      this.updateResourceDisplay();
      this.showTroopsPanel();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  // ============ Commands Panel ============
  async showCommandsPanel() {
    const panel = document.getElementById('command-panel');
    const list = document.getElementById('command-list');

    try {
      const [outgoing, incoming] = await Promise.all([
        api.get(`/commands/outgoing/${this.currentVillage._id}`),
        api.get(`/commands/incoming/${this.currentVillage._id}`)
      ]);

      let html = '<h3 style="margin-bottom:12px;font-size:14px;color:var(--text-secondary)">Giden Komutlar</h3>';
      if (outgoing.commands.length === 0) {
        html += '<p style="color:var(--text-muted);font-size:13px">Giden komut yok</p>';
      }
      outgoing.commands.forEach(cmd => {
        const cls = cmd.isReturning ? 'returning' : cmd.type;
        html += `
          <div class="command-item ${cls}">
            <div>
              <div class="command-type">${cmd.isReturning ? 'Geri Dönüş' : (cmd.type === 'attack' ? 'Saldırı' : 'Destek')}</div>
              <div class="command-target">${cmd.target?.name || 'Bilinmeyen'} (${cmd.target?.x}|${cmd.target?.y})</div>
              <div class="command-timer">${formatTimeUntil(cmd.isReturning ? cmd.returnsAt : cmd.arrivalTime)}</div>
            </div>
          </div>
        `;
      });

      html += '<h3 style="margin:16px 0 12px;font-size:14px;color:var(--text-secondary)">Gelen Komutlar</h3>';
      if (incoming.commands.length === 0) {
        html += '<p style="color:var(--text-muted);font-size:13px">Gelen komut yok</p>';
      }
      incoming.commands.forEach(cmd => {
        html += `
          <div class="command-item ${cmd.type}">
            <div>
              <div class="command-type">${cmd.type === 'attack' ? 'Saldırı' : 'Destek'}</div>
              <div class="command-target">${cmd.origin?.name || '?'} (${cmd.origin?.x}|${cmd.origin?.y})</div>
              <div class="command-timer">${formatTimeUntil(cmd.arrivalTime)}</div>
            </div>
          </div>
        `;
      });

      list.innerHTML = html;
    } catch (err) {
      list.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }

    panel.classList.remove('hidden');
  }

  // ============ Attack Panel ============
  showAttackPanel(targetData) {
    const panel = document.getElementById('attack-panel');
    document.getElementById('attack-target-name').textContent = targetData.villageName;
    document.getElementById('attack-target-coords').textContent =
      ` (${targetData.x}|${targetData.y}) - ${targetData.owner}`;

    let html = '';
    for (const [type, info] of Object.entries(UNITS)) {
      const count = this.currentVillage.troops[type] || 0;
      if (count > 0) {
        html += `
          <div class="troop-card">
            <div class="troop-icon">${info.icon}</div>
            <div class="troop-info">
              <div class="troop-name">${info.name}</div>
              <div class="troop-count">Mevcut: ${count}</div>
            </div>
            <div class="troop-recruit">
              <input type="number" min="0" max="${count}" value="0" id="attack-${type}">
            </div>
          </div>
        `;
      }
    }
    document.getElementById('attack-troop-select').innerHTML = html;

    document.getElementById('btn-send-attack').onclick = () =>
      this.sendCommand('attack', targetData.villageId);
    document.getElementById('btn-send-support').onclick = () =>
      this.sendCommand('support', targetData.villageId);

    panel.classList.remove('hidden');
  }

  async sendCommand(type, targetId) {
    const troops = {};
    for (const unitType of Object.keys(UNITS)) {
      const input = document.getElementById(`attack-${unitType}`);
      if (input) troops[unitType] = parseInt(input.value) || 0;
    }

    try {
      const endpoint = type === 'attack' ? '/commands/attack' : '/commands/support';
      const data = await api.post(endpoint, {
        originId: this.currentVillage._id,
        targetId,
        troops
      });
      this.notify(data.message, 'success');
      document.getElementById('attack-panel').classList.add('hidden');

      const villageData = await api.get(`/villages/${this.currentVillage._id}`);
      this.currentVillage = villageData.village;
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  // ============ Clan Panel ============
  async showClanPanel() {
    const panel = document.getElementById('clan-panel');
    const content = document.getElementById('clan-content');

    if (this.user.clanId) {
      try {
        const data = await api.get(`/clans/${this.user.clanId}`);
        const clan = data.clan;
        content.innerHTML = `
          <div class="clan-header">
            <span class="clan-tag">${clan.tag}</span>
            <h3 class="clan-name">${clan.name}</h3>
            <p style="color:var(--text-secondary);font-size:13px;margin-top:8px">
              ${clan.members.length} Üye | ${formatNumber(clan.points)} Puan
            </p>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">${clan.description || 'Açıklama yok'}</p>

          <h4 style="font-size:14px;margin-bottom:12px">Üyeler</h4>
          ${clan.members.map(m => `
            <div class="member-row">
              <span class="member-role ${m.role}">${m.role === 'leader' ? 'Lider' : m.role === 'co-leader' ? 'Yrd. Lider' : m.role === 'elder' ? 'Elder' : 'Üye'}</span>
              <span style="flex:1;font-size:13px">${m.user?.username || '?'}</span>
              <span style="font-size:12px;color:var(--text-muted)">${formatNumber(m.user?.points || 0)} puan</span>
            </div>
          `).join('')}

          ${clan.diplomacy.length > 0 ? `
            <h4 style="font-size:14px;margin:16px 0 12px">Diplomasi</h4>
            ${clan.diplomacy.map(d => `
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px">
                <span class="diplo-badge ${d.type}">${d.type === 'ally' ? 'Müttefik' : d.type === 'nap' ? 'NAP' : 'Düşman'}</span>
                <span>${d.clan?.name || '?'} [${d.clan?.tag || '?'}]</span>
              </div>
            `).join('')}
          ` : ''}

          <button class="btn btn-danger btn-sm" style="margin-top:16px"
            onclick="window.gameManager.leaveClan()">Klandan Ayrıl</button>
        `;
      } catch (err) {
        content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
      }
    } else {
      content.innerHTML = `
        <p style="color:var(--text-secondary);margin-bottom:20px">Herhangi bir klana üye değilsiniz.</p>
        <h4 style="margin-bottom:12px">Klan Oluştur</h4>
        <div class="form-group">
          <label>Klan Adı</label>
          <input type="text" id="clan-name-input" placeholder="Klan adı" maxlength="30"
            style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);color:var(--text-primary);font-size:13px">
        </div>
        <div class="form-group">
          <label>Klan Etiketi (max 5 harf)</label>
          <input type="text" id="clan-tag-input" placeholder="TAG" maxlength="5"
            style="width:100%;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:var(--radius);color:var(--text-primary);font-size:13px;text-transform:uppercase">
        </div>
        <button class="btn btn-primary" onclick="window.gameManager.createClan()">Klan Oluştur</button>
      `;
    }

    panel.classList.remove('hidden');
  }

  async createClan() {
    const name = document.getElementById('clan-name-input').value;
    const tag = document.getElementById('clan-tag-input').value;
    if (!name || !tag) return this.notify('Klan adı ve etiketi gerekli', 'error');

    try {
      const data = await api.post('/clans', { name, tag });
      this.user.clanId = data.clan._id;
      this.notify('Klan oluşturuldu!', 'success');
      this.showClanPanel();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  async leaveClan() {
    try {
      await api.delete(`/clans/${this.user.clanId}/members/${this.user._id}`);
      this.user.clanId = null;
      this.notify('Klandan ayrıldınız', 'info');
      this.showClanPanel();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  // ============ Market Panel ============
  async showMarketPanel() {
    const panel = document.getElementById('market-panel');
    const content = document.getElementById('market-content');

    try {
      const data = await api.get('/market/offers');
      content.innerHTML = `
        <h4 style="margin-bottom:12px">Teklif Oluştur</h4>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:end;margin-bottom:16px">
          <div>
            <label style="font-size:11px;color:var(--text-muted)">Teklif</label>
            <div style="display:flex;gap:4px;flex-direction:column">
              <input type="number" id="offer-wood" placeholder="Odun" style="padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px">
              <input type="number" id="offer-clay" placeholder="Kil" style="padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px">
              <input type="number" id="offer-iron" placeholder="Demir" style="padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px">
            </div>
          </div>
          <span style="font-size:20px;color:var(--accent)">⇌</span>
          <div>
            <label style="font-size:11px;color:var(--text-muted)">İstek</label>
            <div style="display:flex;gap:4px;flex-direction:column">
              <input type="number" id="req-wood" placeholder="Odun" style="padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px">
              <input type="number" id="req-clay" placeholder="Kil" style="padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px">
              <input type="number" id="req-iron" placeholder="Demir" style="padding:6px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px">
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.gameManager.createMarketOffer()">Teklif Oluştur</button>

        <h4 style="margin:20px 0 12px">Aktif Teklifler (${data.offers.length})</h4>
        ${data.offers.map(o => `
          <div class="offer-card">
            <div style="font-size:12px;color:var(--text-muted)">${o.owner?.username} - ${o.village?.name}</div>
            <div class="offer-exchange">
              <span style="font-size:13px">
                ${o.offer.wood > 0 ? `🪵${o.offer.wood} ` : ''}${o.offer.clay > 0 ? `🧱${o.offer.clay} ` : ''}${o.offer.iron > 0 ? `⛏️${o.offer.iron}` : ''}
              </span>
              <span class="offer-arrow">→</span>
              <span style="font-size:13px">
                ${o.request.wood > 0 ? `🪵${o.request.wood} ` : ''}${o.request.clay > 0 ? `🧱${o.request.clay} ` : ''}${o.request.iron > 0 ? `⛏️${o.request.iron}` : ''}
              </span>
            </div>
            <button class="btn btn-success btn-sm"
              onclick="window.gameManager.acceptOffer('${o._id}')">Kabul Et</button>
          </div>
        `).join('')}
      `;
    } catch (err) {
      content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }

    panel.classList.remove('hidden');
  }

  async createMarketOffer() {
    try {
      const offer = {
        wood: parseInt(document.getElementById('offer-wood').value) || 0,
        clay: parseInt(document.getElementById('offer-clay').value) || 0,
        iron: parseInt(document.getElementById('offer-iron').value) || 0
      };
      const request = {
        wood: parseInt(document.getElementById('req-wood').value) || 0,
        clay: parseInt(document.getElementById('req-clay').value) || 0,
        iron: parseInt(document.getElementById('req-iron').value) || 0
      };

      await api.post('/market/offer', {
        villageId: this.currentVillage._id,
        offer,
        request
      });
      this.notify('Teklif oluşturuldu', 'success');
      this.showMarketPanel();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  async acceptOffer(offerId) {
    try {
      await api.post(`/market/accept/${offerId}`, {
        villageId: this.currentVillage._id
      });
      this.notify('Teklif kabul edildi', 'success');
      this.showMarketPanel();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  // ============ Ranking Panel ============
  async showRankingPanel() {
    const panel = document.getElementById('ranking-panel');
    const content = document.getElementById('ranking-content');

    try {
      const [playerData, clanData] = await Promise.all([
        api.get('/rankings/players'),
        api.get('/rankings/clans')
      ]);

      content.innerHTML = `
        <div class="rank-tabs">
          <button class="rank-tab active" onclick="window.gameManager.showPlayerRanking()">Oyuncular</button>
          <button class="rank-tab" onclick="window.gameManager.showClanRanking()">Klanlar</button>
        </div>
        <div id="ranking-table-container">
          <table class="data-table">
            <thead>
              <tr><th>#</th><th>Oyuncu</th><th>Klan</th><th>Puan</th></tr>
            </thead>
            <tbody>
              ${playerData.players.map(p => `
                <tr>
                  <td style="color:${p.rank <= 3 ? 'var(--accent)' : 'var(--text-muted)'};font-weight:600">${p.rank}</td>
                  <td>${p.username}</td>
                  <td style="color:var(--text-muted)">${p.clanId?.tag ? `[${p.clanId.tag}]` : '-'}</td>
                  <td style="font-weight:600">${formatNumber(p.points)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }

    panel.classList.remove('hidden');
  }

  // ============ Reports Panel ============
  async showReportsPanel() {
    const panel = document.getElementById('reports-panel');
    const content = document.getElementById('reports-content');

    try {
      const data = await api.get('/messages/reports');
      if (data.reports.length === 0) {
        content.innerHTML = '<p style="color:var(--text-muted)">Henüz savaş raporu yok.</p>';
      } else {
        content.innerHTML = data.reports.map(r => {
          const isAttacker = r.attacker.user === this.user._id;
          const won = (isAttacker && r.winner === 'attacker') || (!isAttacker && r.winner === 'defender');
          return `
            <div class="report-card ${isAttacker ? (r.readByAttacker ? '' : 'unread') : (r.readByDefender ? '' : 'unread')}"
              onclick="window.gameManager.showReportDetail('${r._id}')">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="report-result ${won ? 'win' : 'loss'}">${won ? 'Zafer' : 'Yenilgi'}</span>
                <span style="font-size:11px;color:var(--text-muted)">${timeAgo(r.createdAt)}</span>
              </div>
              <div style="font-size:13px;margin-top:8px">
                ${r.attacker.village?.name || '?'} → ${r.defender.village?.name || '?'}
              </div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }

    panel.classList.remove('hidden');
  }

  async showReportDetail(reportId) {
    try {
      const data = await api.get(`/messages/reports/${reportId}`);
      const r = data.report;
      const content = document.getElementById('reports-content');

      content.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="window.gameManager.showReportsPanel()"
          style="margin-bottom:16px">← Geri</button>
        <div class="report-card">
          <div style="display:flex;justify-content:space-between;margin-bottom:12px">
            <span class="report-result ${r.winner === 'attacker' ? 'win' : 'loss'}">
              ${r.winner === 'attacker' ? 'Saldırgan Kazandı' : 'Savunan Kazandı'}
            </span>
            <span style="font-size:11px;color:var(--text-muted)">${timeAgo(r.createdAt)}</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Şans: ${r.luck > 0 ? '+' : ''}${r.luck.toFixed(1)}% | Moral: ${r.morale}%</div>

          <h4 style="margin:12px 0 8px;font-size:13px">Saldırgan - ${r.attacker.villageName}</h4>
          <table class="data-table">
            <thead><tr><th>Birim</th><th>Gönderilen</th><th>Kayıp</th></tr></thead>
            <tbody>
              ${Object.entries(r.attacker.troops).filter(([_, c]) => c > 0).map(([u, c]) => `
                <tr>
                  <td>${UNITS[u]?.name || u}</td>
                  <td>${c}</td>
                  <td style="color:var(--danger)">${r.attacker.losses[u] || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h4 style="margin:12px 0 8px;font-size:13px">Savunan - ${r.defender.villageName}</h4>
          <table class="data-table">
            <thead><tr><th>Birim</th><th>Savunan</th><th>Kayıp</th></tr></thead>
            <tbody>
              ${Object.entries(r.defender.troops).filter(([_, c]) => c > 0).map(([u, c]) => `
                <tr>
                  <td>${UNITS[u]?.name || u}</td>
                  <td>${c}</td>
                  <td style="color:var(--danger)">${r.defender.losses[u] || 0}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${r.loot.wood + r.loot.clay + r.loot.iron > 0 ? `
            <h4 style="margin:12px 0 8px;font-size:13px">Ganimet</h4>
            <div style="display:flex;gap:16px;font-size:13px">
              <span>🪵 ${r.loot.wood}</span>
              <span>🧱 ${r.loot.clay}</span>
              <span>⛏️ ${r.loot.iron}</span>
            </div>
          ` : ''}

          ${r.loyaltyChange > 0 ? `<p style="font-size:13px;margin-top:8px;color:var(--warning)">Sadakat düşüşü: -${r.loyaltyChange}</p>` : ''}
          ${r.buildingDamaged ? `<p style="font-size:13px;color:var(--danger)">Bina hasarı: ${BUILDINGS[r.buildingDamaged]?.name} ${r.buildingLevelBefore} → ${r.buildingLevelAfter}</p>` : ''}
          ${r.defender.wallBefore !== r.defender.wallAfter ? `<p style="font-size:13px;color:var(--danger)">Sur hasarı: ${r.defender.wallBefore} → ${r.defender.wallAfter}</p>` : ''}
        </div>
      `;
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  // ============ Messages Panel ============
  async showMessages() {
    const panel = document.getElementById('messages-panel');
    const content = document.getElementById('messages-content');

    try {
      const data = await api.get('/messages/inbox');
      content.innerHTML = `
        <div class="msg-compose">
          <input type="text" id="msg-to" placeholder="Alıcı kullanıcı adı">
          <input type="text" id="msg-subject" placeholder="Konu">
          <textarea id="msg-body" placeholder="Mesajınız..."></textarea>
          <button class="btn btn-primary btn-sm" onclick="window.gameManager.sendMessage()">Gönder</button>
        </div>
        <h4 style="margin-bottom:12px;font-size:14px">Gelen Kutusu (${data.unread} okunmamış)</h4>
        ${data.messages.map(m => `
          <div class="report-card ${m.read ? '' : 'unread'}" onclick="window.gameManager.readMessage('${m._id}')">
            <div style="display:flex;justify-content:space-between">
              <strong style="font-size:13px">${m.from?.username}</strong>
              <span style="font-size:11px;color:var(--text-muted)">${timeAgo(m.createdAt)}</span>
            </div>
            <div style="font-size:13px;color:var(--text-secondary)">${m.subject}</div>
          </div>
        `).join('')}
      `;
    } catch (err) {
      content.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }

    panel.classList.remove('hidden');
  }

  async sendMessage() {
    try {
      const to = document.getElementById('msg-to').value;
      const subject = document.getElementById('msg-subject').value;
      const body = document.getElementById('msg-body').value;
      await api.post('/messages', { to, subject, body });
      this.notify('Mesaj gönderildi', 'success');
      this.showMessages();
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  async readMessage(id) {
    try {
      const data = await api.get(`/messages/${id}`);
      const m = data.message;
      const content = document.getElementById('messages-content');
      content.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="window.gameManager.showMessages()"
          style="margin-bottom:16px">← Geri</button>
        <div style="background:var(--bg-tertiary);padding:16px;border-radius:var(--radius)">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <strong>${m.from?.username}</strong>
            <span style="font-size:11px;color:var(--text-muted)">${timeAgo(m.createdAt)}</span>
          </div>
          <h4 style="margin-bottom:12px">${m.subject}</h4>
          <p style="font-size:13px;color:var(--text-secondary);white-space:pre-wrap">${m.body}</p>
        </div>
      `;
    } catch (err) {
      this.notify(err.message, 'error');
    }
  }

  // ============ Resource Management ============
  updateResourceDisplay() {
    if (!this.currentVillage) return;
    const r = this.currentVillage.resources;
    document.getElementById('wood-amount').textContent = formatNumber(r.wood);
    document.getElementById('clay-amount').textContent = formatNumber(r.clay);
    document.getElementById('iron-amount').textContent = formatNumber(r.iron);
  }

  startResourceTimer() {
    if (this.resourceInterval) clearInterval(this.resourceInterval);
    this.resourceInterval = setInterval(() => {
      if (!this.currentVillage) return;
      // Client-side kaynak interpolasyonu
      const r = this.currentVillage.resources;
      const b = this.currentVillage.buildings;

      // Basit üretim hesaplaması
      const woodRate = this.getProductionRate(b.timberCamp.level);
      const clayRate = this.getProductionRate(b.clayPit.level);
      const ironRate = this.getProductionRate(b.ironMine.level);

      r.wood += woodRate / 3600;
      r.clay += clayRate / 3600;
      r.iron += ironRate / 3600;

      document.getElementById('wood-amount').textContent = formatNumber(r.wood);
      document.getElementById('clay-amount').textContent = formatNumber(r.clay);
      document.getElementById('iron-amount').textContent = formatNumber(r.iron);
      document.getElementById('wood-rate').textContent = `(+${Math.round(woodRate)}/h)`;
      document.getElementById('clay-rate').textContent = `(+${Math.round(clayRate)}/h)`;
      document.getElementById('iron-rate').textContent = `(+${Math.round(ironRate)}/h)`;
    }, 1000);
  }

  getProductionRate(level) {
    if (level === 0) return 5;
    return Math.round(30 * Math.pow(1.163, level - 1));
  }

  updateQueueDisplay() {
    const container = document.getElementById('queue-display');
    const buildList = document.getElementById('build-queue-list');
    const troopList = document.getElementById('troop-queue-list');

    if (!this.currentVillage) return;

    const bq = this.currentVillage.buildQueue || [];
    const tq = this.currentVillage.troopQueue || [];

    if (bq.length === 0 && tq.length === 0) {
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');

    buildList.innerHTML = bq.map(q => `
      <div class="queue-item">
        <span>${BUILDINGS[q.building]?.name || q.building} Sv.${q.targetLevel}</span>
        <span class="queue-timer" data-end="${q.completesAt}"></span>
      </div>
    `).join('');

    troopList.innerHTML = tq.map(q => `
      <div class="queue-item">
        <span>${UNITS[q.unitType]?.name || q.unitType} x${q.amount}</span>
        <span class="queue-timer" data-end="${q.completesAt}"></span>
      </div>
    `).join('');

    // Timer güncelleme
    this.startQueueTimers();
  }

  startQueueTimers() {
    if (this.queueTimerInterval) clearInterval(this.queueTimerInterval);
    this.queueTimerInterval = setInterval(() => {
      document.querySelectorAll('.queue-timer[data-end]').forEach(el => {
        el.textContent = formatTimeUntil(el.dataset.end);
      });
    }, 1000);
  }

  // ============ Socket Events ============
  setupSocketListeners() {
    socketClient.on('village:buildComplete', async (data) => {
      this.notify(`Bina inşaatı tamamlandı!`, 'success');
      const villageData = await api.get(`/villages/${data.villageId}`);
      this.currentVillage = villageData.village;
      this.updateResourceDisplay();
      this.updateQueueDisplay();
      if (this.villageScene) {
        this.villageScene.updateBuildings(this.currentVillage.buildings);
      }
    });

    socketClient.on('village:troopComplete', (data) => {
      this.notify(`${UNITS[data.unitType]?.name} eğitimi tamamlandı! (${data.amount})`, 'success');
      this.refreshVillage();
    });

    socketClient.on('command:incoming', (data) => {
      this.notify(`Gelen ${data.type === 'attack' ? 'SALDIRI' : 'destek'}!`, data.type === 'attack' ? 'error' : 'info');
    });

    socketClient.on('battle:report', (data) => {
      this.notify(`Savaş raporu: ${data.winner === 'attacker' ? 'Saldırgan kazandı' : 'Savunan kazandı'}`,
        data.winner === 'attacker' ? 'warning' : 'info');
    });

    socketClient.on('command:returned', () => {
      this.notify('Birlikler geri döndü!', 'success');
      this.refreshVillage();
    });

    socketClient.on('message:new', (data) => {
      this.notify(`Yeni mesaj: ${data.subject}`, 'info');
    });

    socketClient.on('announcement', (data) => {
      this.notify(`📢 ${data.title}: ${data.message}`, 'warning');
    });
  }

  async refreshVillage() {
    const data = await api.get(`/villages/${this.currentVillage._id}`);
    this.currentVillage = data.village;
    this.updateResourceDisplay();
    this.updateQueueDisplay();
  }

  // ============ Notifications ============
  notify(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.textContent = message;
    container.appendChild(notif);
    setTimeout(() => notif.remove(), 4000);
  }
}
