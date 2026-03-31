import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Mesaj gönder
router.post('/', auth, async (req, res, next) => {
  try {
    const { to, subject, body } = req.body;
    const recipient = await User.findOne({ username: to });
    if (!recipient) return res.status(404).json({ error: 'Oyuncu bulunamadı' });

    const message = new Message({
      from: req.userId,
      to: recipient._id,
      subject,
      body
    });
    await message.save();

    const io = req.app.get('io');
    io?.to(`user:${recipient._id}`).emit('message:new', { messageId: message._id, subject });

    res.status(201).json({ message: 'Mesaj gönderildi' });
  } catch (error) {
    next(error);
  }
});

// Gelen kutusu
router.get('/inbox', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const messages = await Message.find({ to: req.userId, deletedByReceiver: false })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('from', 'username');

    const total = await Message.countDocuments({ to: req.userId, deletedByReceiver: false });
    const unread = await Message.countDocuments({ to: req.userId, read: false, deletedByReceiver: false });

    res.json({ messages, total, unread, page });
  } catch (error) {
    next(error);
  }
});

// Giden kutusu
router.get('/sent', auth, async (req, res, next) => {
  try {
    const messages = await Message.find({ from: req.userId, deletedBySender: false })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('to', 'username');
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

// Mesaj oku
router.get('/:id', auth, async (req, res, next) => {
  try {
    const message = await Message.findById(req.params.id)
      .populate('from', 'username')
      .populate('to', 'username');
    if (!message) return res.status(404).json({ error: 'Mesaj bulunamadı' });

    if (message.to._id.toString() !== req.userId && message.from._id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Yetki yok' });
    }

    if (message.to._id.toString() === req.userId && !message.read) {
      message.read = true;
      await message.save();
    }

    res.json({ message });
  } catch (error) {
    next(error);
  }
});

// Raporlar
router.get('/reports', auth, async (req, res, next) => {
  try {
    const BattleReport = (await import('../models/BattleReport.js')).default;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const reports = await BattleReport.find({
      $or: [{ 'attacker.user': req.userId }, { 'defender.user': req.userId }]
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('attacker.village', 'name x y')
      .populate('defender.village', 'name x y');

    const total = await BattleReport.countDocuments({
      $or: [{ 'attacker.user': req.userId }, { 'defender.user': req.userId }]
    });

    res.json({ reports, total, page });
  } catch (error) {
    next(error);
  }
});

// Rapor detayı
router.get('/reports/:id', auth, async (req, res, next) => {
  try {
    const BattleReport = (await import('../models/BattleReport.js')).default;
    const report = await BattleReport.findById(req.params.id)
      .populate('attacker.village', 'name x y')
      .populate('defender.village', 'name x y');

    if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });

    const isAttacker = report.attacker.user.toString() === req.userId;
    const isDefender = report.defender.user?.toString() === req.userId;
    if (!isAttacker && !isDefender) {
      return res.status(403).json({ error: 'Yetki yok' });
    }

    if (isAttacker) { report.readByAttacker = true; }
    if (isDefender) { report.readByDefender = true; }
    await report.save();

    res.json({ report });
  } catch (error) {
    next(error);
  }
});

export default router;
