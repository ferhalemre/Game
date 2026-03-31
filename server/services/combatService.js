import Village from '../models/Village.js';
import Command from '../models/Command.js';
import BattleReport from '../models/BattleReport.js';
import User from '../models/User.js';
import units from '../config/units.js';
import gameSettings from '../config/gameSettings.js';
import { calculateLuck, calculateMorale, getWallDefenseBonus, calculateDistance } from '../utils/formulas.js';
import { calculateResources } from './resourceService.js';
import { getStorageCapacity } from '../utils/formulas.js';

export async function resolveBattle(command, io) {
  const origin = await Village.findById(command.origin._id || command.origin).populate('owner');
  const target = await Village.findById(command.target._id || command.target).populate('owner');

  if (!origin || !target) {
    command.status = 'completed';
    await command.save();
    return;
  }

  // Kaynakları güncelle
  await calculateResources(target);

  const luck = calculateLuck();
  const attackerPoints = origin.owner ? origin.owner.points : 100;
  const defenderPoints = target.owner ? target.owner.points : 100;
  const morale = calculateMorale(attackerPoints, defenderPoints);

  // Saldırı gücü hesapla
  let totalAttack = 0;
  const attackerTroops = {};
  for (const [unit, count] of Object.entries(command.troops)) {
    if (count > 0 && units[unit]) {
      totalAttack += units[unit].attack * count;
      attackerTroops[unit] = count;
    }
  }
  totalAttack *= (1 + luck / 100) * (morale / 100);

  // Savunma gücü hesapla (savunan birliklerin türüne göre ağırlıklı)
  let totalDefense = 0;
  const defenderTroops = {};

  // Ana garnizon
  for (const [unit, count] of Object.entries(target.troops)) {
    if (count > 0 && units[unit]) {
      totalDefense += units[unit].defGeneral * count;
      defenderTroops[unit] = (defenderTroops[unit] || 0) + count;
    }
  }

  // Destek birlikleri
  for (const support of target.supportTroops) {
    for (const [unit, count] of Object.entries(support.troops)) {
      if (count > 0 && units[unit]) {
        totalDefense += units[unit].defGeneral * count;
        defenderTroops[unit] = (defenderTroops[unit] || 0) + count;
      }
    }
  }

  // Sur bonusu
  const wallBonus = getWallDefenseBonus(target.buildings.wall.level);
  totalDefense *= wallBonus;

  // Savaş sonucu hesapla
  const attackerWins = totalAttack > totalDefense;
  const ratio = attackerWins
    ? (totalDefense > 0 ? totalDefense / totalAttack : 0)
    : (totalAttack > 0 ? totalAttack / totalDefense : 0);

  // Kayıpları hesapla
  const attackerLosses = {};
  const defenderLosses = {};
  const survivingAttackers = {};
  const survivingDefenders = {};

  if (attackerWins) {
    // Saldırgan kazandı: savunanın tamamı yok, saldırganın ratio kadarı kayıp
    for (const [unit, count] of Object.entries(attackerTroops)) {
      const lost = Math.round(count * Math.pow(ratio, 1.5));
      attackerLosses[unit] = lost;
      survivingAttackers[unit] = count - lost;
    }
    for (const [unit, count] of Object.entries(defenderTroops)) {
      defenderLosses[unit] = count;
      survivingDefenders[unit] = 0;
    }
  } else {
    // Savunan kazandı: saldırganın tamamı yok, savunanın ratio kadarı kayıp
    for (const [unit, count] of Object.entries(attackerTroops)) {
      attackerLosses[unit] = count;
      survivingAttackers[unit] = 0;
    }
    for (const [unit, count] of Object.entries(defenderTroops)) {
      const lost = Math.round(count * Math.pow(ratio, 1.5));
      defenderLosses[unit] = lost;
      survivingDefenders[unit] = count - lost;
    }
  }

  // Sur hasarı (koçbaşı varsa)
  let wallBefore = target.buildings.wall.level;
  let wallAfter = wallBefore;
  if (attackerWins && command.troops.ram > 0) {
    const ramSurvived = survivingAttackers.ram || 0;
    const wallDamage = Math.floor(ramSurvived / 4);
    wallAfter = Math.max(0, wallBefore - wallDamage);
    target.buildings.wall.level = wallAfter;
  }

  // Bina hasarı (mancınık varsa)
  let buildingDamaged = null;
  let buildingLevelBefore = null;
  let buildingLevelAfter = null;
  if (attackerWins && command.troops.catapult > 0) {
    const catSurvived = survivingAttackers.catapult || 0;
    if (catSurvived > 0) {
      const buildingTypes = Object.keys(target.buildings).filter(b => target.buildings[b].level > 0);
      if (buildingTypes.length > 0) {
        buildingDamaged = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
        buildingLevelBefore = target.buildings[buildingDamaged].level;
        const damage = Math.min(buildingLevelBefore, Math.floor(catSurvived / 8) + 1);
        buildingLevelAfter = buildingLevelBefore - damage;
        target.buildings[buildingDamaged].level = buildingLevelAfter;
      }
    }
  }

  // Loot hesapla (saldırgan kazandıysa)
  let loot = { wood: 0, clay: 0, iron: 0 };
  if (attackerWins) {
    let totalCarry = 0;
    for (const [unit, count] of Object.entries(survivingAttackers)) {
      if (count > 0 && units[unit]) {
        totalCarry += units[unit].carry * count;
      }
    }
    const available = {
      wood: target.resources.wood,
      clay: target.resources.clay,
      iron: target.resources.iron
    };
    const totalAvailable = available.wood + available.clay + available.iron;
    if (totalAvailable > 0 && totalCarry > 0) {
      const ratio = Math.min(1, totalCarry / totalAvailable);
      loot.wood = Math.floor(available.wood * ratio);
      loot.clay = Math.floor(available.clay * ratio);
      loot.iron = Math.floor(available.iron * ratio);
    }
    target.resources.wood -= loot.wood;
    target.resources.clay -= loot.clay;
    target.resources.iron -= loot.iron;
  }

  // Sadakat düşürme (soylu varsa ve saldırgan kazandıysa)
  let loyaltyChange = 0;
  if (attackerWins && (survivingAttackers.noble || 0) > 0) {
    loyaltyChange = Math.floor(
      Math.random() * (gameSettings.noble.loyaltyMax - gameSettings.noble.loyaltyMin + 1)
    ) + gameSettings.noble.loyaltyMin;
    target.loyalty -= loyaltyChange;

    // Köy ele geçirildi
    if (target.loyalty <= 0) {
      const oldOwner = target.owner;
      target.owner = command.owner;
      target.loyalty = 25;
      target.supportTroops = [];

      // Eski sahibinden köyü kaldır
      if (oldOwner) {
        await User.findByIdAndUpdate(oldOwner._id || oldOwner, {
          $pull: { villages: target._id }
        });
      }
      // Yeni sahibine köyü ekle
      await User.findByIdAndUpdate(command.owner, {
        $push: { villages: target._id }
      });
    }
  }

  // Savunan birlikleri güncelle
  for (const [unit, count] of Object.entries(survivingDefenders)) {
    target.troops[unit] = Math.max(0, count);
  }

  // Destek birlikleri kayıplarını da uygula
  // (basitleştirilmiş - oransal kayıp)
  if (Object.values(defenderLosses).some(v => v > 0)) {
    target.supportTroops = target.supportTroops.map(support => {
      const newTroops = {};
      for (const [unit, count] of Object.entries(support.troops)) {
        const totalOfType = defenderTroops[unit] || 0;
        if (totalOfType > 0) {
          const lossRatio = (defenderLosses[unit] || 0) / totalOfType;
          newTroops[unit] = Math.max(0, Math.round(count * (1 - lossRatio)));
        } else {
          newTroops[unit] = count;
        }
      }
      return { ...support, troops: newTroops };
    }).filter(s => Object.values(s.troops).some(v => v > 0));
  }

  await target.save();

  // Savaş raporu oluştur
  const report = new BattleReport({
    attacker: {
      user: command.owner,
      village: command.origin._id || command.origin,
      villageName: origin.name,
      troops: attackerTroops,
      losses: attackerLosses
    },
    defender: {
      user: target.owner,
      village: target._id,
      villageName: target.name,
      troops: defenderTroops,
      losses: defenderLosses,
      wallBefore,
      wallAfter
    },
    loot,
    loyaltyChange,
    luck,
    morale,
    winner: attackerWins ? 'attacker' : 'defender',
    buildingDamaged,
    buildingLevelBefore,
    buildingLevelAfter
  });
  await report.save();

  // ODA/ODD puanları güncelle
  const attackerKillPoints = calculateKillPoints(defenderLosses);
  const defenderKillPoints = calculateKillPoints(attackerLosses);

  if (command.owner) {
    await User.findByIdAndUpdate(command.owner, { $inc: { offensivePoints: attackerKillPoints } });
  }
  if (target.owner) {
    await User.findByIdAndUpdate(target.owner._id || target.owner, { $inc: { defensivePoints: defenderKillPoints } });
  }

  // Geri dönüş komutu
  if (attackerWins && Object.values(survivingAttackers).some(v => v > 0)) {
    const distance = calculateDistance(
      origin.x, origin.y,
      target.x, target.y
    );

    let slowestSpeed = 0;
    for (const [unit, count] of Object.entries(survivingAttackers)) {
      if (count > 0 && units[unit]) {
        slowestSpeed = Math.max(slowestSpeed, units[unit].speed);
      }
    }

    const travelTimeMs = (distance * slowestSpeed * 60 * 1000) / gameSettings.unitSpeed;

    command.status = 'returning';
    command.isReturning = true;
    command.troops = survivingAttackers;
    command.resources = loot;
    command.returnsAt = new Date(Date.now() + travelTimeMs);
    await command.save();
  } else {
    command.status = 'completed';
    await command.save();
  }

  // Socket bildirimleri
  if (io) {
    if (command.owner) {
      io.to(`user:${command.owner}`).emit('battle:report', {
        reportId: report._id,
        winner: report.winner,
        villageId: target._id
      });
    }
    if (target.owner && target.owner._id) {
      io.to(`user:${target.owner._id}`).emit('battle:report', {
        reportId: report._id,
        winner: report.winner,
        villageId: target._id
      });
    }
  }
}

function calculateKillPoints(losses) {
  let points = 0;
  for (const [unit, count] of Object.entries(losses)) {
    if (count > 0 && units[unit]) {
      const cost = units[unit].cost;
      points += Math.round(((cost.wood + cost.clay + cost.iron) / 3) * count / 10);
    }
  }
  return points;
}
