import buildings from '../config/buildings.js';
import units from '../config/units.js';
import gameSettings from '../config/gameSettings.js';

// Bina maliyeti hesapla
export function getBuildingCost(buildingType, targetLevel) {
  const b = buildings[buildingType];
  if (!b) return null;
  const level = targetLevel - 1;
  return {
    wood: Math.round(b.baseCost.wood * Math.pow(b.costFactor, level)),
    clay: Math.round(b.baseCost.clay * Math.pow(b.costFactor, level)),
    iron: Math.round(b.baseCost.iron * Math.pow(b.costFactor, level))
  };
}

// Bina inşaat süresi hesapla (saniye)
export function getBuildingTime(buildingType, targetLevel, townHallLevel) {
  const b = buildings[buildingType];
  if (!b) return null;
  const level = targetLevel - 1;
  const baseTime = b.baseTime * Math.pow(b.timeFactor, level);
  const thReduction = buildings.townHall.buildSpeedFactor
    ? Math.pow(buildings.townHall.buildSpeedFactor, townHallLevel)
    : 1;
  return Math.round(baseTime * thReduction / gameSettings.worldSpeed);
}

// Kaynak üretimi hesapla (saat başı)
export function getResourceProduction(buildingType, level) {
  const b = buildings[buildingType];
  if (!b || !b.productionBase) return 0;
  if (level === 0) return 5; // Baz üretim
  return Math.round(b.productionBase * Math.pow(b.productionFactor, level - 1)) * gameSettings.worldSpeed;
}

// Depo kapasitesi
export function getStorageCapacity(warehouseLevel) {
  const b = buildings.warehouse;
  if (warehouseLevel === 0) return b.storageCapacityBase;
  return Math.round(b.storageCapacityBase * Math.pow(b.storageCapacityFactor, warehouseLevel - 1));
}

// Nüfus kapasitesi (çiftlik)
export function getPopulationCapacity(farmLevel) {
  const b = buildings.farm;
  if (farmLevel === 0) return b.populationCapacityBase;
  return Math.round(b.populationCapacityBase * Math.pow(b.populationCapacityFactor, farmLevel - 1));
}

// Bina nüfus maliyeti
export function getBuildingPopulation(buildingType, level) {
  const b = buildings[buildingType];
  if (!b || level === 0) return 0;
  return Math.round(b.populationBase * Math.pow(b.populationFactor, level - 1));
}

// Toplam köy nüfusu
export function calculateVillagePopulation(villageBuildings, troops) {
  let pop = 0;
  for (const [type, data] of Object.entries(villageBuildings)) {
    pop += getBuildingPopulation(type, data.level);
  }
  if (troops) {
    for (const [type, count] of Object.entries(troops)) {
      if (units[type]) pop += units[type].population * count;
    }
  }
  return pop;
}

// Köy puanı hesapla
export function calculateVillagePoints(villageBuildings) {
  let points = 0;
  for (const [type, data] of Object.entries(villageBuildings)) {
    const b = buildings[type];
    if (b && b.points && data.level > 0) {
      points += b.points[data.level - 1] || 0;
    }
  }
  return points;
}

// İki köy arası mesafe
export function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Yolculuk süresi hesapla (saniye)
export function calculateTravelTime(distance, slowestUnitSpeed) {
  return Math.round((distance * slowestUnitSpeed * 60) / gameSettings.unitSpeed);
}

// Sur savunma bonusu
export function getWallDefenseBonus(wallLevel) {
  const b = buildings.wall;
  return b.defenseBonus[wallLevel] || 1.0;
}

// Savaş şans faktörü (-25% ile +25%)
export function calculateLuck() {
  return (Math.random() * 50 - 25);
}

// Moral hesaplama
export function calculateMorale(attackerPoints, defenderPoints) {
  if (!gameSettings.morale.enabled) return 100;
  if (attackerPoints <= gameSettings.morale.minPoints) return 100;
  const ratio = defenderPoints / attackerPoints;
  return Math.min(100, Math.max(25, Math.round(ratio * 100)));
}
