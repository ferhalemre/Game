import express from 'express';
import User from '../models/User.js';
import Village from '../models/Village.js';
import Clan from '../models/Clan.js';
import Command from '../models/Command.js';
import BattleReport from '../models/BattleReport.js';
import { auth, adminAuth } from '../middleware/auth.js';
import gameSettings from '../config/gameSettings.js';

const router = express.Router();

// Dashboard istatistikleri
router.get('/dashboard', auth, adminAuth, async (req, res, next) => {
  try {
    const [playerCount, villageCount, clanCount, activeCommands, recentBattles] = await Promise.all([
      User.countDocuments(),
      Village.countDocuments(),
      Clan.countDocuments(),
      Command.countDocuments({ status: { $in: ['traveling', 'returning'] } }),
      BattleReport.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) } })
    ]);

    const onlinePlayers = await User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 900000) }
    });

    const topPlayers = await User.find().sort({ points: -1 }).limit(10)
      .select('username points offensivePoints');

    res.json({
      stats: {
        playerCount,
        villageCount,
        clanCount,
        activeCommands,
        recentBattles,
        onlinePlayers
      },
      topPlayers,
      gameSettings
    });
  } catch (error) {
    next(error);
  }
});

// Oyuncu listesi
router.get('/players', auth, adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = 25;

    const query = search ? { username: new RegExp(search, 'i') } : {};
    const players = await User.find(query)
      .sort({ points: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-password')
      .populate('clanId', 'name tag');

    const total = await User.countDocuments(query);
    res.json({ players, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// Oyuncu düzenle
router.put('/players/:id', auth, adminAuth, async (req, res, next) => {
  try {
    const { isBanned, banReason, role, addResources } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Oyuncu bulunamadı' });

    if (isBanned !== undefined) {
      user.isBanned = isBanned;
      user.banReason = banReason || '';
    }
    if (role) user.role = role;
    await user.save();

    // Kaynak ekleme
    if (addResources) {
      const villages = await Village.find({ owner: user._id });
      if (villages.length > 0) {
        const v = villages[0];
        v.resources.wood += addResources.wood || 0;
        v.resources.clay += addResources.clay || 0;
        v.resources.iron += addResources.iron || 0;
        await v.save();
      }
    }

    res.json({ message: 'Oyuncu güncellendi', user: user.toPublic() });
  } catch (error) {
    next(error);
  }
});

// Köy listesi
router.get('/villages', auth, adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const villages = await Village.find()
      .sort({ points: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('owner', 'username');

    const total = await Village.countDocuments();
    res.json({ villages, total, page });
  } catch (error) {
    next(error);
  }
});

// Oyun ayarları güncelle
router.put('/settings', auth, adminAuth, async (req, res, next) => {
  try {
    const { worldSpeed, unitSpeed, maxBuildQueue, maxTroopQueue } = req.body;
    if (worldSpeed) gameSettings.worldSpeed = worldSpeed;
    if (unitSpeed) gameSettings.unitSpeed = unitSpeed;
    if (maxBuildQueue) gameSettings.maxBuildQueue = maxBuildQueue;
    if (maxTroopQueue) gameSettings.maxTroopQueue = maxTroopQueue;

    res.json({ message: 'Ayarlar güncellendi', gameSettings });
  } catch (error) {
    next(error);
  }
});

// Duyuru yayınla
router.post('/announcements', auth, adminAuth, async (req, res, next) => {
  try {
    const { title, message } = req.body;
    const io = req.app.get('io');
    io?.emit('announcement', { title, message, timestamp: new Date() });
    res.json({ message: 'Duyuru yayınlandı' });
  } catch (error) {
    next(error);
  }
});

// Savaş logları
router.get('/logs', auth, adminAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const reports = await BattleReport.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('attacker.village', 'name')
      .populate('defender.village', 'name');

    const total = await BattleReport.countDocuments();
    res.json({ reports, total, page });
  } catch (error) {
    next(error);
  }
});

export default router;
