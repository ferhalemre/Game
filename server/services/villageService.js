import Village from '../models/Village.js';
import gameSettings from '../config/gameSettings.js';
import { calculateVillagePoints } from '../utils/formulas.js';

// Yeni oyuncu için başlangıç köyü oluştur
export async function createStarterVillage(userId, username) {
  const coords = await findEmptyCoords();

  const village = new Village({
    name: `${username}'in Köyü`,
    owner: userId,
    x: coords.x,
    y: coords.y,
    resources: {
      wood: gameSettings.startingResources.wood,
      clay: gameSettings.startingResources.clay,
      iron: gameSettings.startingResources.iron,
      lastCalculated: new Date()
    },
    buildings: {
      townHall: { level: 1 },
      barracks: { level: 0 },
      stable: { level: 0 },
      workshop: { level: 0 },
      academy: { level: 0 },
      smithy: { level: 0 },
      rallyPoint: { level: 0 },
      market: { level: 0 },
      timberCamp: { level: 1 },
      clayPit: { level: 1 },
      ironMine: { level: 1 },
      farm: { level: 1 },
      warehouse: { level: 1 },
      wall: { level: 0 }
    }
  });

  village.points = calculateVillagePoints(village.buildings);
  await village.save();
  return village;
}

// Boş koordinat bul (spiral arama)
async function findEmptyCoords() {
  const center = Math.floor(gameSettings.worldSize / 2);
  let x = center, y = center;
  let dx = 0, dy = -1;
  const maxSteps = gameSettings.worldSize * gameSettings.worldSize;

  for (let i = 0; i < maxSteps; i++) {
    if (x >= 0 && x < gameSettings.worldSize && y >= 0 && y < gameSettings.worldSize) {
      const existing = await Village.findOne({ x, y });
      if (!existing) return { x, y };
    }

    if (x === y || (x < 0 && x === -y) || (x > 0 && x === 1 - y)) {
      [dx, dy] = [-dy, dx];
    }
    x += dx;
    y += dy;
  }

  // Rastgele pozisyon fallback
  for (let i = 0; i < 1000; i++) {
    x = Math.floor(Math.random() * gameSettings.worldSize);
    y = Math.floor(Math.random() * gameSettings.worldSize);
    const existing = await Village.findOne({ x, y });
    if (!existing) return { x, y };
  }

  throw new Error('Haritada boş yer bulunamadı');
}

// Barbar köyleri oluştur (seed script için)
export async function generateBarbarianVillages(count) {
  const villages = [];
  for (let i = 0; i < count; i++) {
    try {
      const coords = await findEmptyCoords();
      const level = Math.floor(Math.random() * gameSettings.barbarianMaxLevel) + 1;

      const village = new Village({
        name: `Barbar Köyü`,
        owner: null,
        x: coords.x,
        y: coords.y,
        isBarbarian: true,
        resources: {
          wood: 200 * level,
          clay: 200 * level,
          iron: 200 * level,
          lastCalculated: new Date()
        },
        buildings: {
          townHall: { level: Math.min(level, 3) },
          barracks: { level: Math.min(level, 1) },
          stable: { level: 0 },
          workshop: { level: 0 },
          academy: { level: 0 },
          smithy: { level: 0 },
          rallyPoint: { level: 0 },
          market: { level: 0 },
          timberCamp: { level: level },
          clayPit: { level: level },
          ironMine: { level: level },
          farm: { level: Math.min(level + 1, 5) },
          warehouse: { level: Math.min(level, 5) },
          wall: { level: Math.min(level, 3) }
        },
        troops: {
          spearman: level * 10,
          swordsman: 0,
          axeman: 0,
          lightCavalry: 0,
          heavyCavalry: 0,
          mountedArcher: 0,
          ram: 0,
          catapult: 0,
          noble: 0,
          paladin: 0
        }
      });

      village.points = calculateVillagePoints(village.buildings);
      await village.save();
      villages.push(village);
    } catch (e) {
      console.log('Barbar köyü oluşturma hatası:', e.message);
    }
  }
  return villages;
}
