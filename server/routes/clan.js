import express from 'express';
import Clan from '../models/Clan.js';
import User from '../models/User.js';
import { auth } from '../middleware/auth.js';
import gameSettings from '../config/gameSettings.js';

const router = express.Router();

// Klan oluştur
router.post('/', auth, async (req, res, next) => {
  try {
    const { name, tag, description } = req.body;
    const user = await User.findById(req.userId);
    if (user.clanId) return res.status(400).json({ error: 'Zaten bir klana üyesiniz' });

    const clan = new Clan({
      name,
      tag: tag.toUpperCase(),
      leader: req.userId,
      description: description || '',
      members: [{ user: req.userId, role: 'leader' }],
      points: user.points
    });
    await clan.save();

    user.clanId = clan._id;
    await user.save();

    res.status(201).json({ clan });
  } catch (error) {
    next(error);
  }
});

// Klan bilgisi
router.get('/:id', auth, async (req, res, next) => {
  try {
    const clan = await Clan.findById(req.params.id)
      .populate('members.user', 'username points offensivePoints defensivePoints')
      .populate('diplomacy.clan', 'name tag');
    if (!clan) return res.status(404).json({ error: 'Klan bulunamadı' });
    res.json({ clan });
  } catch (error) {
    next(error);
  }
});

// Klana katılma isteği / doğrudan katıl (davetli ise)
router.post('/:id/join', auth, async (req, res, next) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Klan bulunamadı' });

    const user = await User.findById(req.userId);
    if (user.clanId) return res.status(400).json({ error: 'Zaten bir klana üyesiniz' });

    if (clan.members.length >= clan.memberLimit) {
      return res.status(400).json({ error: 'Klan dolu' });
    }

    // Davetli mi kontrol et
    const inviteIndex = clan.invites.findIndex(i => i.user.toString() === req.userId);
    if (inviteIndex === -1) {
      return res.status(400).json({ error: 'Bu klana katılmak için davet gerekli' });
    }

    clan.invites.splice(inviteIndex, 1);
    clan.members.push({ user: req.userId, role: 'member' });
    clan.points = await calculateClanPoints(clan.members);
    await clan.save();

    user.clanId = clan._id;
    await user.save();

    res.json({ message: 'Klana katıldınız', clan });
  } catch (error) {
    next(error);
  }
});

// Oyuncu davet et
router.post('/:id/invite', auth, async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.body;
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Klan bulunamadı' });

    const member = clan.members.find(m => m.user.toString() === req.userId);
    if (!member || !['leader', 'co-leader', 'elder'].includes(member.role)) {
      return res.status(403).json({ error: 'Davet yetkisi yok' });
    }

    const target = await User.findById(targetUserId);
    if (!target) return res.status(404).json({ error: 'Oyuncu bulunamadı' });
    if (target.clanId) return res.status(400).json({ error: 'Oyuncu zaten bir klana üye' });

    const alreadyInvited = clan.invites.some(i => i.user.toString() === targetUserId);
    if (alreadyInvited) return res.status(400).json({ error: 'Zaten davet edilmiş' });

    clan.invites.push({ user: targetUserId, invitedBy: req.userId });
    await clan.save();

    res.json({ message: 'Davet gönderildi' });
  } catch (error) {
    next(error);
  }
});

// Üye çıkar
router.delete('/:id/members/:userId', auth, async (req, res, next) => {
  try {
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Klan bulunamadı' });

    const requester = clan.members.find(m => m.user.toString() === req.userId);
    const targetId = req.params.userId;
    const isSelf = targetId === req.userId;

    if (!isSelf) {
      if (!requester || !['leader', 'co-leader'].includes(requester.role)) {
        return res.status(403).json({ error: 'Yetki yok' });
      }
    }

    if (targetId === clan.leader.toString() && !isSelf) {
      return res.status(400).json({ error: 'Lider çıkarılamaz' });
    }

    clan.members = clan.members.filter(m => m.user.toString() !== targetId);

    // Lider ayrılıyorsa
    if (targetId === clan.leader.toString()) {
      if (clan.members.length > 0) {
        const newLeader = clan.members.find(m => m.role === 'co-leader') || clan.members[0];
        clan.leader = newLeader.user;
        newLeader.role = 'leader';
      } else {
        await Clan.findByIdAndDelete(clan._id);
        await User.findByIdAndUpdate(targetId, { clanId: null });
        return res.json({ message: 'Klan silindi (son üye ayrıldı)' });
      }
    }

    clan.points = await calculateClanPoints(clan.members);
    await clan.save();
    await User.findByIdAndUpdate(targetId, { clanId: null });

    res.json({ message: isSelf ? 'Klandan ayrıldınız' : 'Üye çıkarıldı' });
  } catch (error) {
    next(error);
  }
});

// Diplomasi ayarla
router.put('/:id/diplomacy', auth, async (req, res, next) => {
  try {
    const { targetClanId, type } = req.body;
    const clan = await Clan.findById(req.params.id);
    if (!clan) return res.status(404).json({ error: 'Klan bulunamadı' });

    const member = clan.members.find(m => m.user.toString() === req.userId);
    if (!member || !['leader', 'co-leader'].includes(member.role)) {
      return res.status(403).json({ error: 'Diplomasi yetkisi yok' });
    }

    const targetClan = await Clan.findById(targetClanId);
    if (!targetClan) return res.status(404).json({ error: 'Hedef klan bulunamadı' });

    const existingIndex = clan.diplomacy.findIndex(d => d.clan.toString() === targetClanId);
    if (type === 'remove') {
      if (existingIndex !== -1) clan.diplomacy.splice(existingIndex, 1);
    } else {
      if (existingIndex !== -1) {
        clan.diplomacy[existingIndex].type = type;
      } else {
        clan.diplomacy.push({ clan: targetClanId, type });
      }
    }
    await clan.save();

    res.json({ message: 'Diplomasi güncellendi', diplomacy: clan.diplomacy });
  } catch (error) {
    next(error);
  }
});

// Klan listesi
router.get('/', auth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const clans = await Clan.find()
      .sort({ points: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('name tag points members leader')
      .populate('leader', 'username');

    const total = await Clan.countDocuments();
    res.json({ clans, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

async function calculateClanPoints(members) {
  const userIds = members.map(m => m.user);
  const users = await User.find({ _id: { $in: userIds } });
  return users.reduce((sum, u) => sum + u.points, 0);
}

export default router;
