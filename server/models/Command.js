import mongoose from 'mongoose';

const commandSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['attack', 'support', 'spy', 'return'],
    required: true
  },
  origin: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', required: true },
  target: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  resources: {
    wood: { type: Number, default: 0 },
    clay: { type: Number, default: 0 },
    iron: { type: Number, default: 0 }
  },
  departureTime: { type: Date, required: true },
  arrivalTime: { type: Date, required: true },
  returnsAt: { type: Date, default: null },
  isReturning: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['traveling', 'arrived', 'returning', 'completed'],
    default: 'traveling'
  }
}, { timestamps: true });

commandSchema.index({ arrivalTime: 1, status: 1 });
commandSchema.index({ origin: 1, status: 1 });
commandSchema.index({ target: 1, status: 1 });

const Command = mongoose.model('Command', commandSchema);
export default Command;
