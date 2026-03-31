import Village from '../models/Village.js';
import Command from '../models/Command.js';
import User from '../models/User.js';
import { calculateResources } from './resourceService.js';
import { resolveBattle } from './combatService.js';
import { calculateVillagePoints } from '../utils/formulas.js';

let io = null;
let tickInterval = null;

export function startGameTick(socketIo) {
  io = socketIo;
  tickInterval = setInterval(processTick, 1000);
  console.log('Oyun tick sistemi başlatıldı (1s aralık)');
}

export function stopGameTick() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

async function processTick() {
  try {
    const now = new Date();

    // 1. Bina kuyruklarını işle
    await processBuildQueues(now);

    // 2. Asker kuyruklarını işle
    await processTroopQueues(now);

    // 3. Komut varışlarını işle
    await processCommands(now);

  } catch (err) {
    console.error('Tick hatası:', err);
  }
}

async function processBuildQueues(now) {
  const villages = await Village.find({
    'buildQueue.0': { $exists: true },
    'buildQueue.completesAt': { $lte: now }
  });

  for (const village of villages) {
    let changed = false;
    const remaining = [];

    for (const item of village.buildQueue) {
      if (new Date(item.completesAt) <= now) {
        village.buildings[item.building].level = item.targetLevel;
        village.points = calculateVillagePoints(village.buildings);
        changed = true;

        // Socket bildirimi gönder
        if (io && village.owner) {
          io.to(`user:${village.owner}`).emit('village:buildComplete', {
            villageId: village._id,
            building: item.building,
            level: item.targetLevel,
            points: village.points
          });
        }
      } else {
        remaining.push(item);
      }
    }

    if (changed) {
      village.buildQueue = remaining;
      await village.save();

      // Kullanıcı puanını güncelle
      if (village.owner) {
        const userVillages = await Village.find({ owner: village.owner });
        const totalPoints = userVillages.reduce((sum, v) => sum + v.points, 0);
        await User.findByIdAndUpdate(village.owner, { points: totalPoints });
      }
    }
  }
}

async function processTroopQueues(now) {
  const villages = await Village.find({
    'troopQueue.0': { $exists: true },
    'troopQueue.completesAt': { $lte: now }
  });

  for (const village of villages) {
    let changed = false;
    const remaining = [];

    for (const item of village.troopQueue) {
      if (new Date(item.completesAt) <= now) {
        village.troops[item.unitType] += item.amount;
        changed = true;

        if (io && village.owner) {
          io.to(`user:${village.owner}`).emit('village:troopComplete', {
            villageId: village._id,
            unitType: item.unitType,
            amount: item.amount
          });
        }
      } else {
        remaining.push(item);
      }
    }

    if (changed) {
      village.troopQueue = remaining;
      await village.save();
    }
  }
}

async function processCommands(now) {
  // Varan komutları işle
  const arrivedCommands = await Command.find({
    status: 'traveling',
    isReturning: false,
    arrivalTime: { $lte: now }
  }).populate('origin target');

  for (const cmd of arrivedCommands) {
    try {
      if (cmd.type === 'attack') {
        await resolveBattle(cmd, io);
      } else if (cmd.type === 'support') {
        await resolveSupport(cmd, io);
      }
    } catch (err) {
      console.error('Komut işleme hatası:', err);
    }
  }

  // Geri dönen komutları işle
  const returningCommands = await Command.find({
    status: 'returning',
    isReturning: true,
    returnsAt: { $lte: now }
  }).populate('origin');

  for (const cmd of returningCommands) {
    try {
      const origin = await Village.findById(cmd.origin._id || cmd.origin);
      if (origin) {
        // Birlikleri köye geri ekle
        for (const [unit, count] of Object.entries(cmd.troops)) {
          if (count > 0) origin.troops[unit] += count;
        }
        // Loot kaynaklarını ekle
        if (cmd.resources) {
          origin.resources.wood += cmd.resources.wood || 0;
          origin.resources.clay += cmd.resources.clay || 0;
          origin.resources.iron += cmd.resources.iron || 0;
        }
        await origin.save();
      }

      cmd.status = 'completed';
      await cmd.save();

      if (io && cmd.owner) {
        io.to(`user:${cmd.owner}`).emit('command:returned', {
          commandId: cmd._id,
          villageId: cmd.origin._id || cmd.origin
        });
      }
    } catch (err) {
      console.error('Geri dönüş işleme hatası:', err);
    }
  }
}

async function resolveSupport(cmd, io) {
  const target = await Village.findById(cmd.target._id || cmd.target);
  if (!target) return;

  target.supportTroops.push({
    from: cmd.origin._id || cmd.origin,
    owner: cmd.owner,
    troops: { ...cmd.troops }
  });
  await target.save();

  cmd.status = 'completed';
  await cmd.save();

  if (io) {
    if (target.owner) {
      io.to(`user:${target.owner}`).emit('village:supportArrived', {
        villageId: target._id,
        from: cmd.origin._id || cmd.origin
      });
    }
    io.to(`user:${cmd.owner}`).emit('command:completed', {
      commandId: cmd._id
    });
  }
}
