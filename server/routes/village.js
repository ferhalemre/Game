import express from 'express';
import Village from '../models/Village.js';
import buildings from '../config/buildings.js';
import units from '../config/units.js';
import { auth } from '../middleware/auth.js';
import { calculateResources, deductResources, hasEnoughResources } from '../services/resourceService.js';
import { getBuildingCost, getBuildingTime, calculateVillagePoints, getPopulationCapacity, getBuildingPopulation } from '../utils/formulas.js';
import gameSettings from '../config/gameSettings.js';

const router = express.Router();

// Köy bilgisi al
router.get('/:id', auth, async (req, res, next) => {
  try {
    const village = await Village.findById(req.params.id);
    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });

    // Kaynakları güncelle (kendi köyümüz ise)
    if (village.owner && village.owner.toString() === req.userId) {
      await calculateResources(village);
      await village.save();
    }

    res.json({ village });
  } catch (error) {
    next(error);
  }
});

// Bina yükselt
router.post('/:id/build', auth, async (req, res, next) => {
  try {
    const { building } = req.body;
    const village = await Village.findById(req.params.id);

    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });
    if (village.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    const buildingConfig = buildings[building];
    if (!buildingConfig) return res.status(400).json({ error: 'Geçersiz bina tipi' });

    // Kuyruk sınırı kontrolü
    if (village.buildQueue.length >= gameSettings.maxBuildQueue) {
      return res.status(400).json({ error: `Maksimum ${gameSettings.maxBuildQueue} bina kuyruğa alınabilir` });
    }

    // Mevcut + kuyruktaki seviye
    const currentLevel = village.buildings[building].level;
    const queuedLevels = village.buildQueue.filter(q => q.building === building).length;
    const targetLevel = currentLevel + queuedLevels + 1;

    if (targetLevel > buildingConfig.maxLevel) {
      return res.status(400).json({ error: 'Bina maksimum seviyeye ulaşmış' });
    }

    // Gereksinim kontrolü
    if (buildingConfig.requirement) {
      for (const [req_building, req_level] of Object.entries(buildingConfig.requirement)) {
        const actualLevel = village.buildings[req_building]?.level || 0;
        const queuedMax = village.buildQueue
          .filter(q => q.building === req_building)
          .reduce((max, q) => Math.max(max, q.targetLevel), actualLevel);
        if (queuedMax < req_level) {
          return res.status(400).json({
            error: `${buildings[req_building].name} seviye ${req_level} gerekli`
          });
        }
      }
    }

    // Kaynakları güncelle
    await calculateResources(village);

    // Maliyet kontrolü
    const cost = getBuildingCost(building, targetLevel);
    if (!hasEnoughResources(village, cost)) {
      return res.status(400).json({ error: 'Yetersiz kaynak', required: cost });
    }

    // Süre hesapla
    const buildTime = getBuildingTime(building, targetLevel, village.buildings.townHall.level);

    // Kuyrukta en son bitenin zamanı
    const lastQueueEnd = village.buildQueue.length > 0
      ? new Date(village.buildQueue[village.buildQueue.length - 1].completesAt)
      : new Date();

    const completesAt = new Date(Math.max(lastQueueEnd.getTime(), Date.now()) + buildTime * 1000);

    deductResources(village, cost);
    village.buildQueue.push({ building, targetLevel, completesAt });
    await village.save();

    res.json({
      message: `${buildingConfig.name} seviye ${targetLevel} kuyruğa alındı`,
      queue: village.buildQueue,
      resources: village.resources
    });
  } catch (error) {
    next(error);
  }
});

// Bina kuyruğundan iptal
router.delete('/:id/build/:queueIndex', auth, async (req, res, next) => {
  try {
    const village = await Village.findById(req.params.id);
    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });
    if (village.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    const index = parseInt(req.params.queueIndex);
    if (index < 0 || index >= village.buildQueue.length) {
      return res.status(400).json({ error: 'Geçersiz kuyruk indeksi' });
    }

    // Sadece son eleman iptal edilebilir
    if (index !== village.buildQueue.length - 1) {
      return res.status(400).json({ error: 'Sadece kuyruktaki son bina iptal edilebilir' });
    }

    const cancelled = village.buildQueue[index];
    const cost = getBuildingCost(cancelled.building, cancelled.targetLevel);

    // Kaynakları iade et (% oranında)
    village.resources.wood += Math.floor(cost.wood * 0.9);
    village.resources.clay += Math.floor(cost.clay * 0.9);
    village.resources.iron += Math.floor(cost.iron * 0.9);

    village.buildQueue.splice(index, 1);
    await village.save();

    res.json({ message: 'İptal edildi', queue: village.buildQueue, resources: village.resources });
  } catch (error) {
    next(error);
  }
});

// Asker eğit
router.post('/:id/recruit', auth, async (req, res, next) => {
  try {
    const { unitType, amount } = req.body;
    const village = await Village.findById(req.params.id);

    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });
    if (village.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    const unitConfig = units[unitType];
    if (!unitConfig) return res.status(400).json({ error: 'Geçersiz birim tipi' });

    if (amount <= 0 || amount > 5000) {
      return res.status(400).json({ error: 'Geçersiz miktar (1-5000)' });
    }

    // Gereksinim kontrolü
    if (unitConfig.requirement) {
      for (const [req_building, req_level] of Object.entries(unitConfig.requirement)) {
        if ((village.buildings[req_building]?.level || 0) < req_level) {
          return res.status(400).json({
            error: `${buildings[req_building]?.name || req_building} seviye ${req_level} gerekli`
          });
        }
      }
    }

    // Nüfus kontrolü
    const farmCap = getPopulationCapacity(village.buildings.farm.level);
    let currentPop = 0;
    for (const [type, data] of Object.entries(village.buildings)) {
      currentPop += getBuildingPopulation(type, data.level);
    }
    for (const [type, count] of Object.entries(village.troops)) {
      if (units[type]) currentPop += units[type].population * count;
    }
    // Kuyruktaki askerler
    for (const q of village.troopQueue) {
      if (units[q.unitType]) currentPop += units[q.unitType].population * q.amount;
    }

    const neededPop = unitConfig.population * amount;
    if (currentPop + neededPop > farmCap) {
      return res.status(400).json({ error: 'Yetersiz çiftlik kapasitesi' });
    }

    // Kaynak kontrolü
    await calculateResources(village);
    const totalCost = {
      wood: unitConfig.cost.wood * amount,
      clay: unitConfig.cost.clay * amount,
      iron: unitConfig.cost.iron * amount
    };

    if (!hasEnoughResources(village, totalCost)) {
      return res.status(400).json({ error: 'Yetersiz kaynak', required: totalCost });
    }

    // Unique birim kontrolü (paladin)
    if (unitConfig.unique && unitConfig.maxPerVillage) {
      const existing = village.troops[unitType] +
        village.troopQueue.filter(q => q.unitType === unitType).reduce((s, q) => s + q.amount, 0);
      if (existing + amount > unitConfig.maxPerVillage) {
        return res.status(400).json({ error: `Bu köyde en fazla ${unitConfig.maxPerVillage} ${unitConfig.name} olabilir` });
      }
    }

    const eachTime = unitConfig.buildTime / gameSettings.worldSpeed;
    const lastQueueEnd = village.troopQueue.length > 0
      ? new Date(village.troopQueue[village.troopQueue.length - 1].completesAt)
      : new Date();

    const startTime = new Date(Math.max(lastQueueEnd.getTime(), Date.now()));
    const completesAt = new Date(startTime.getTime() + eachTime * amount * 1000);

    deductResources(village, totalCost);
    village.troopQueue.push({
      unitType,
      amount,
      eachTime,
      startedAt: startTime,
      completesAt
    });
    await village.save();

    res.json({
      message: `${amount} ${unitConfig.name} eğitiliyor`,
      troopQueue: village.troopQueue,
      resources: village.resources
    });
  } catch (error) {
    next(error);
  }
});

// Köy ismi değiştir
router.put('/:id/name', auth, async (req, res, next) => {
  try {
    const { name } = req.body;
    const village = await Village.findById(req.params.id);
    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });
    if (village.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    village.name = name.substring(0, 30);
    await village.save();
    res.json({ message: 'Köy ismi güncellendi', name: village.name });
  } catch (error) {
    next(error);
  }
});

export default router;
