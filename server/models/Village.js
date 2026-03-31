import mongoose from 'mongoose';

const villageSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 30 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  points: { type: Number, default: 36 },
  isBarbarian: { type: Boolean, default: false },

  resources: {
    wood: { type: Number, default: 500 },
    clay: { type: Number, default: 500 },
    iron: { type: Number, default: 500 },
    lastCalculated: { type: Date, default: Date.now }
  },

  buildings: {
    townHall: { level: { type: Number, default: 1 } },
    barracks: { level: { type: Number, default: 0 } },
    stable: { level: { type: Number, default: 0 } },
    workshop: { level: { type: Number, default: 0 } },
    academy: { level: { type: Number, default: 0 } },
    smithy: { level: { type: Number, default: 0 } },
    rallyPoint: { level: { type: Number, default: 0 } },
    market: { level: { type: Number, default: 0 } },
    timberCamp: { level: { type: Number, default: 1 } },
    clayPit: { level: { type: Number, default: 1 } },
    ironMine: { level: { type: Number, default: 1 } },
    farm: { level: { type: Number, default: 1 } },
    warehouse: { level: { type: Number, default: 1 } },
    wall: { level: { type: Number, default: 0 } }
  },

  troops: {
    spearman: { type: Number, default: 0 },
    swordsman: { type: Number, default: 0 },
    axeman: { type: Number, default: 0 },
    lightCavalry: { type: Number, default: 0 },
    heavyCavalry: { type: Number, default: 0 },
    mountedArcher: { type: Number, default: 0 },
    ram: { type: Number, default: 0 },
    catapult: { type: Number, default: 0 },
    noble: { type: Number, default: 0 },
    paladin: { type: Number, default: 0 }
  },

  supportTroops: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'Village' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    troops: {
      spearman: { type: Number, default: 0 },
      swordsman: { type: Number, default: 0 },
      axeman: { type: Number, default: 0 },
      lightCavalry: { type: Number, default: 0 },
      heavyCavalry: { type: Number, default: 0 },
      mountedArcher: { type: Number, default: 0 },
      ram: { type: Number, default: 0 },
      catapult: { type: Number, default: 0 },
      noble: { type: Number, default: 0 },
      paladin: { type: Number, default: 0 }
    }
  }],

  buildQueue: [{
    building: { type: String, required: true },
    targetLevel: { type: Number, required: true },
    completesAt: { type: Date, required: true }
  }],

  troopQueue: [{
    unitType: { type: String, required: true },
    amount: { type: Number, required: true },
    eachTime: { type: Number, required: true },
    startedAt: { type: Date, required: true },
    completesAt: { type: Date, required: true }
  }],

  loyalty: { type: Number, default: 100, min: 0, max: 100 }
}, {
  timestamps: true
});

villageSchema.index({ x: 1, y: 1 }, { unique: true });
villageSchema.index({ owner: 1 });
villageSchema.index({ isBarbarian: 1 });

const Village = mongoose.model('Village', villageSchema);
export default Village;
