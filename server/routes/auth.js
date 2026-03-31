import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Village from '../models/Village.js';
import gameSettings from '../config/gameSettings.js';
import { createStarterVillage } from '../services/villageService.js';

const router = express.Router();

// Kayıt
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tüm alanlar gerekli' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ error: 'Bu kullanıcı adı veya email zaten kullanılıyor' });
    }

    const user = new User({
      username,
      email,
      password,
      beginnerProtectionUntil: new Date(Date.now() + gameSettings.beginnerProtectionHours * 3600000)
    });

    await user.save();

    // Başlangıç köyü oluştur
    const village = await createStarterVillage(user._id, username);
    user.villages.push(village._id);
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      user: user.toPublic(),
      accessToken,
      refreshToken,
      village: village._id
    });
  } catch (error) {
    next(error);
  }
});

// Giriş
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email ve şifre gerekli' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Hesabınız engellenmiş', reason: user.banReason });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Geçersiz email veya şifre' });
    }

    user.lastLogin = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      user: user.toPublic(),
      accessToken,
      refreshToken
    });
  } catch (error) {
    next(error);
  }
});

// Token yenileme
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token gerekli' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.isBanned) {
      return res.status(403).json({ error: 'Geçersiz token' });
    }

    const accessToken = generateAccessToken(user);
    res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ error: 'Geçersiz refresh token' });
  }
});

// Mevcut kullanıcı bilgisi
router.get('/me', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token gerekli' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('villages');
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    res.json({ user: user.toPublic(), villages: user.villages });
  } catch (error) {
    return res.status(401).json({ error: 'Geçersiz token' });
  }
});

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export default router;
