// Bina ve birim bilgileri (client-side)
export const BUILDINGS = {
  townHall:   { name: 'Belediye Binası', icon: '🏛️' },
  barracks:   { name: 'Kışla',           icon: '⚔️' },
  stable:     { name: 'Ahır',            icon: '🐴' },
  workshop:   { name: 'Atölye',          icon: '🔧' },
  academy:    { name: 'Akademi',         icon: '📚' },
  smithy:     { name: 'Demirci',         icon: '🔨' },
  rallyPoint: { name: 'Toplanma Yeri',   icon: '🚩' },
  market:     { name: 'Pazar',           icon: '💰' },
  timberCamp: { name: 'Kereste Kampı',   icon: '🪵' },
  clayPit:    { name: 'Tuğla Ocağı',     icon: '🧱' },
  ironMine:   { name: 'Demir Madeni',    icon: '⛏️' },
  farm:       { name: 'Çiftlik',         icon: '🌾' },
  warehouse:  { name: 'Depo',            icon: '📦' },
  wall:       { name: 'Sur',             icon: '🏰' }
};

export const UNITS = {
  spearman:      { name: 'Mızrakçı',     icon: '🗡️' },
  swordsman:     { name: 'Kılıçlı',      icon: '⚔️' },
  axeman:        { name: 'Baltacı',       icon: '🪓' },
  lightCavalry:  { name: 'Hafif Süvari',  icon: '🐎' },
  heavyCavalry:  { name: 'Ağır Süvari',   icon: '🛡️' },
  mountedArcher: { name: 'Atlı Okçu',     icon: '🏹' },
  ram:           { name: 'Koçbaşı',       icon: '🐏' },
  catapult:      { name: 'Mancınık',      icon: '💣' },
  noble:         { name: 'Soylu',         icon: '👑' },
  paladin:       { name: 'Paladin',       icon: '🗡️' }
};

export function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

export function formatTime(seconds) {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimeUntil(dateStr) {
  const diff = (new Date(dateStr) - Date.now()) / 1000;
  return formatTime(Math.max(0, diff));
}

export function timeAgo(dateStr) {
  const seconds = (Date.now() - new Date(dateStr)) / 1000;
  if (seconds < 60) return 'Az önce';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk önce`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa önce`;
  return `${Math.floor(seconds / 86400)} gün önce`;
}
