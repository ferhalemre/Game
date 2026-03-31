import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['player', 'moderator', 'admin'],
    default: 'player'
  },
  villages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Village'
  }],
  clanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clan',
    default: null
  },
  points: { type: Number, default: 0 },
  offensivePoints: { type: Number, default: 0 },
  defensivePoints: { type: Number, default: 0 },
  lastLogin: { type: Date, default: Date.now },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  beginnerProtectionUntil: { type: Date, default: null }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublic = function() {
  return {
    _id: this._id,
    username: this.username,
    role: this.role,
    points: this.points,
    offensivePoints: this.offensivePoints,
    defensivePoints: this.defensivePoints,
    clanId: this.clanId,
    villages: this.villages,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

const User = mongoose.model('User', userSchema);
export default User;
