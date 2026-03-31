import mongoose from 'mongoose';

const clanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, maxlength: 30 },
  tag: { type: String, required: true, unique: true, maxlength: 5, uppercase: true },
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String, default: '', maxlength: 2000 },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['leader', 'co-leader', 'elder', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],
  invites: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  diplomacy: [{
    clan: { type: mongoose.Schema.Types.ObjectId, ref: 'Clan' },
    type: { type: String, enum: ['ally', 'nap', 'enemy'] },
    since: { type: Date, default: Date.now }
  }],
  points: { type: Number, default: 0 },
  memberLimit: { type: Number, default: 50 }
}, { timestamps: true });

clanSchema.index({ tag: 1 });
clanSchema.index({ points: -1 });

const Clan = mongoose.model('Clan', clanSchema);
export default Clan;
