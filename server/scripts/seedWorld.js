import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/db.js';
import User from '../models/User.js';
import { generateBarbarianVillages } from '../services/villageService.js';
import gameSettings from '../config/gameSettings.js';

async function seed() {
  await connectDB();

  console.log('=== KlanSavasi Dünya Oluşturucu ===\n');

  // Admin hesabı oluştur
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (!existingAdmin) {
    const admin = new User({
      username: 'Admin',
      email: 'admin@klansavasi.com',
      password: 'admin123',
      role: 'admin'
    });
    await admin.save();
    console.log('Admin hesabı oluşturuldu:');
    console.log('  Email: admin@klansavasi.com');
    console.log('  Şifre: admin123\n');
  } else {
    console.log('Admin hesabı zaten mevcut.\n');
  }

  // Barbar köyleri oluştur
  const totalTiles = gameSettings.worldSize * gameSettings.worldSize;
  const barbarianCount = Math.floor(totalTiles * (gameSettings.barbarianVillagePercent / 100));
  const targetCount = Math.min(barbarianCount, 200); // İlk seed için 200 barbar köyü

  console.log(`Barbar köyleri oluşturuluyor (${targetCount} adet)...`);
  const created = await generateBarbarianVillages(targetCount);
  console.log(`${created.length} barbar köyü oluşturuldu.\n`);

  console.log('=== Dünya hazır! ===');
  console.log(`Dünya boyutu: ${gameSettings.worldSize}x${gameSettings.worldSize}`);
  console.log(`Dünya hızı: ${gameSettings.worldSpeed}x`);
  console.log('\nSunucuyu başlatmak için: npm run server');
  console.log('Client\'ı başlatmak için: npm run client');
  console.log('Her ikisini birden: npm run dev');

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed hatası:', err);
  process.exit(1);
});
