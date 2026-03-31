import mongoose from 'mongoose';

const battleReportSchema = new mongoose.Schema({
  attacker: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    village: { type: mongoose.Schema.Types.ObjectId, ref: 'Village' },
    villageName: String,
    troops: Object,
    losses: Object
  },
  defender: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    village: { type: mongoose.Schema.Types.ObjectId, ref: 'Village' },
    villageName: String,
    troops: Object,
    losses: Object,
    wallBefore: Number,
    wallAfter: Number
  },
  loot: {
    wood: { type: Number, default: 0 },
    clay: { type: Number, default: 0 },
    iron: { type: Number, default: 0 }
  },
  loyaltyChange: { type: Number, default: 0 },
  luck: { type: Number, default: 0 },
  morale: { type: Number, default: 100 },
  winner: { type: String, enum: ['attacker', 'defender'] },
  buildingDamaged: { type: String, default: null },
  buildingLevelBefore: { type: Number, default: null },
  buildingLevelAfter: { type: Number, default: null },
  readByAttacker: { type: Boolean, default: false },
  readByDefender: { type: Boolean, default: false }
}, { timestamps: true });

battleReportSchema.index({ 'attacker.user': 1, createdAt: -1 });
battleReportSchema.index({ 'defender.user': 1, createdAt: -1 });

const BattleReport = mongoose.model('BattleReport', battleReportSchema);
export default BattleReport;
