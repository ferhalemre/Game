import express from 'express';
import User from '../models/User.js';
import Clan from '../models/Clan.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Oyuncu sıralaması
router.get('/players', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const type = req.query.type || 'points'; // points, oda, odd

    let sortField = 'points';
    if (type === 'oda') sortField = 'offensivePoints';
    if (type === 'odd') sortField = 'defensivePoints';

    const players = await User.find({ isBanned: false })
      .sort({ [sortField]: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('username points offensivePoints defensivePoints clanId villages')
      .populate('clanId', 'name tag');

    const total = await User.countDocuments({ isBanned: false });
    res.json({
      players: players.map((p, i) => ({
        rank: (page - 1) * limit + i + 1,
        ...p.toObject()
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// Klan sıralaması
router.get('/clans', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;

    const clans = await Clan.find()
      .sort({ points: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name tag points members');

    const total = await Clan.countDocuments();
    res.json({
      clans: clans.map((c, i) => ({
        rank: (page - 1) * limit + i + 1,
        name: c.name,
        tag: c.tag,
        points: c.points,
        memberCount: c.members.length
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
