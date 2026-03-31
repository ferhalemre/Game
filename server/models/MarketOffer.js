import mongoose from 'mongoose';

const marketOfferSchema = new mongoose.Schema({
  village: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  offer: {
    wood: { type: Number, default: 0 },
    clay: { type: Number, default: 0 },
    iron: { type: Number, default: 0 }
  },
  request: {
    wood: { type: Number, default: 0 },
    clay: { type: Number, default: 0 },
    iron: { type: Number, default: 0 }
  },
  maxDistance: { type: Number, default: 0 }, // 0 = sınırsız
  status: { type: String, enum: ['active', 'accepted', 'cancelled'], default: 'active' },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Village', default: null },
  deliveryTime: { type: Date, default: null }
}, { timestamps: true });

marketOfferSchema.index({ status: 1, createdAt: -1 });

const MarketOffer = mongoose.model('MarketOffer', marketOfferSchema);
export default MarketOffer;
