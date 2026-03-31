import './styles/main.css';
import { api } from './network/ApiClient.js';
import { GameManager } from './game/GameManager.js';

// Global referans (UI onclick handler'lar için)
window.gameManager = null;

// DOM hazır olduğunda başlat
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Mevcut token var mı kontrol et
  if (api.accessToken) {
    try {
      const data = await api.get('/auth/me');
      startGame(data);
      return;
    } catch {
      api.clearTokens();
    }
  }

  setupAuthForms();
}

function setupAuthForms() {
  // Tab geçişleri
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.dataset.tab;
      document.getElementById(`${target}-form`).classList.add('active');
    });
  });

  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    try {
      errorEl.textContent = '';
      const data = await api.post('/auth/login', { email, password });
      api.setTokens(data.accessToken, data.refreshToken);
      startGame(data);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // Register form
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorEl = document.getElementById('register-error');

    try {
      errorEl.textContent = '';
      const data = await api.post('/auth/register', { username, email, password });
      api.setTokens(data.accessToken, data.refreshToken);
      startGame(data);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

async function startGame(userData) {
  // Auth ekranından oyun ekranına geçiş
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');

  const gm = new GameManager();
  window.gameManager = gm;
  await gm.init(userData);
}
