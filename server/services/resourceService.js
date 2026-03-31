import Village from '../models/Village.js';
import gameSettings from '../config/gameSettings.js';
import { getResourceProduction, getStorageCapacity } from '../utils/formulas.js';

// Kaynakları lazy hesapla ve güncelle
export async function calculateResources(village) {
  const now = new Date();
  const lastCalc = new Date(village.resources.lastCalculated);
  const hoursPassed = (now - lastCalc) / 3600000;

  if (hoursPassed < 0.001) return village;

  const woodProduction = getResourceProduction('timberCamp', village.buildings.timberCamp.level);
  const clayProduction = getResourceProduction('clayPit', village.buildings.clayPit.level);
  const ironProduction = getResourceProduction('ironMine', village.buildings.ironMine.level);

  const storageCapacity = getStorageCapacity(village.buildings.warehouse.level);

  village.resources.wood = Math.min(storageCapacity,
    village.resources.wood + (woodProduction * hoursPassed));
  village.resources.clay = Math.min(storageCapacity,
    village.resources.clay + (clayProduction * hoursPassed));
  village.resources.iron = Math.min(storageCapacity,
    village.resources.iron + (ironProduction * hoursPassed));
  village.resources.lastCalculated = now;

  return village;
}

// Kaynakları düş
export function deductResources(village, cost) {
  village.resources.wood -= cost.wood;
  village.resources.clay -= cost.clay;
  village.resources.iron -= cost.iron;
  return village;
}

// Kaynak yeterliliği kontrolü
export function hasEnoughResources(village, cost) {
  return village.resources.wood >= cost.wood &&
    village.resources.clay >= cost.clay &&
    village.resources.iron >= cost.iron;
}
