import express from 'express';
import Command from '../models/Command.js';
import Village from '../models/Village.js';
import units from '../config/units.js';
import gameSettings from '../config/gameSettings.js';
import { auth } from '../middleware/auth.js';
import { calculateDistance, calculateTravelTime } from '../utils/formulas.js';

const router = express.Router();

// Saldırı gönder
router.post('/attack', auth, async (req, res, next) => {
  try {
    const { originId, targetId, troops } = req.body;

    const origin = await Village.findById(originId);
    const target = await Village.findById(targetId);

    if (!origin) return res.status(404).json({ error: 'Kaynak köy bulunamadı' });
    if (!target) return res.status(404).json({ error: 'Hedef köy bulunamadı' });
    if (origin.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }
    if (origin._id.toString() === target._id.toString()) {
      return res.status(400).json({ error: 'Kendi köyünüze saldıramazsınız' });
    }

    // Birlikleri doğrula
    let hasTroops = false;
    let slowestSpeed = 0;
    const troopData = {};

    for (const [unit, count] of Object.entries(troops)) {
      const cnt = parseInt(count) || 0;
      if (cnt <= 0) continue;
      if (!units[unit]) return res.status(400).json({ error: `Geçersiz birim: ${unit}` });
      if (cnt > origin.troops[unit]) {
        return res.status(400).json({ error: `Yetersiz ${units[unit].name}` });
      }
      troopData[unit] = cnt;
      slowestSpeed = Math.max(slowestSpeed, units[unit].speed);
      hasTroops = true;
    }

    if (!hasTroops) return res.status(400).json({ error: 'En az bir birim seçmelisiniz' });

    const distance = calculateDistance(origin.x, origin.y, target.x, target.y);
    const travelTimeSec = calculateTravelTime(distance, slowestSpeed);
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + travelTimeSec * 1000);

    // Birlikleri köyden çıkar
    for (const [unit, count] of Object.entries(troopData)) {
      origin.troops[unit] -= count;
    }
    await origin.save();

    const command = new Command({
      type: 'attack',
      origin: origin._id,
      target: target._id,
      owner: req.userId,
      troops: troopData,
      departureTime: now,
      arrivalTime
    });
    await command.save();

    // Hedefe bildirim
    if (target.owner) {
      const io = req.app.get('io');
      io?.to(`user:${target.owner}`).emit('command:incoming', {
        type: 'attack',
        arrivalTime,
        from: { x: origin.x, y: origin.y }
      });
    }

    res.json({
      message: 'Saldırı gönderildi',
      command: {
        _id: command._id,
        arrivalTime,
        travelTimeSec,
        distance: Math.round(distance * 100) / 100
      }
    });
  } catch (error) {
    next(error);
  }
});

// Destek gönder
router.post('/support', auth, async (req, res, next) => {
  try {
    const { originId, targetId, troops } = req.body;

    const origin = await Village.findById(originId);
    const target = await Village.findById(targetId);

    if (!origin) return res.status(404).json({ error: 'Kaynak köy bulunamadı' });
    if (!target) return res.status(404).json({ error: 'Hedef köy bulunamadı' });
    if (origin.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    let hasTroops = false;
    let slowestSpeed = 0;
    const troopData = {};

    for (const [unit, count] of Object.entries(troops)) {
      const cnt = parseInt(count) || 0;
      if (cnt <= 0) continue;
      if (!units[unit]) return res.status(400).json({ error: `Geçersiz birim: ${unit}` });
      if (cnt > origin.troops[unit]) {
        return res.status(400).json({ error: `Yetersiz ${units[unit].name}` });
      }
      troopData[unit] = cnt;
      slowestSpeed = Math.max(slowestSpeed, units[unit].speed);
      hasTroops = true;
    }

    if (!hasTroops) return res.status(400).json({ error: 'En az bir birim seçmelisiniz' });

    const distance = calculateDistance(origin.x, origin.y, target.x, target.y);
    const travelTimeSec = calculateTravelTime(distance, slowestSpeed);
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + travelTimeSec * 1000);

    for (const [unit, count] of Object.entries(troopData)) {
      origin.troops[unit] -= count;
    }
    await origin.save();

    const command = new Command({
      type: 'support',
      origin: origin._id,
      target: target._id,
      owner: req.userId,
      troops: troopData,
      departureTime: now,
      arrivalTime
    });
    await command.save();

    res.json({
      message: 'Destek gönderildi',
      command: { _id: command._id, arrivalTime, travelTimeSec }
    });
  } catch (error) {
    next(error);
  }
});

// Gelen komutlar
router.get('/incoming/:villageId', auth, async (req, res, next) => {
  try {
    const village = await Village.findById(req.params.villageId);
    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });
    if (village.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    const commands = await Command.find({
      target: village._id,
      status: 'traveling',
      isReturning: false
    }).select('type arrivalTime origin').populate('origin', 'name x y');

    res.json({ commands });
  } catch (error) {
    next(error);
  }
});

// Giden komutlar
router.get('/outgoing/:villageId', auth, async (req, res, next) => {
  try {
    const village = await Village.findById(req.params.villageId);
    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });
    if (village.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    const commands = await Command.find({
      origin: village._id,
      status: { $in: ['traveling', 'returning'] }
    }).populate('target', 'name x y');

    res.json({ commands });
  } catch (error) {
    next(error);
  }
});

export default router;
