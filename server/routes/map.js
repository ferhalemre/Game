import express from 'express';
import Village from '../models/Village.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Harita chunk verileri
router.get('/', auth, async (req, res, next) => {
  try {
    const x = parseInt(req.query.x) || 250;
    const y = parseInt(req.query.y) || 250;
    const range = Math.min(parseInt(req.query.range) || 20, 50);

    const villages = await Village.find({
      x: { $gte: x - range, $lte: x + range },
      y: { $gte: y - range, $lte: y + range }
    }).select('name x y points owner isBarbarian buildings.wall.level').populate('owner', 'username clanId');

    res.json({ villages, center: { x, y }, range });
  } catch (error) {
    next(error);
  }
});

export default router;
