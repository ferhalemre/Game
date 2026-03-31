import express from 'express';
import MarketOffer from '../models/MarketOffer.js';
import Village from '../models/Village.js';
import { auth } from '../middleware/auth.js';
import { calculateResources, hasEnoughResources, deductResources } from '../services/resourceService.js';

const router = express.Router();

// Teklif oluştur
router.post('/offer', auth, async (req, res, next) => {
  try {
    const { villageId, offer, request, maxDistance } = req.body;
    const village = await Village.findById(villageId);
    if (!village) return res.status(404).json({ error: 'Köy bulunamadı' });
    if (village.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu köy size ait değil' });
    }

    await calculateResources(village);
    if (!hasEnoughResources(village, offer)) {
      return res.status(400).json({ error: 'Yetersiz kaynak' });
    }

    deductResources(village, offer);
    await village.save();

    const marketOffer = new MarketOffer({
      village: village._id,
      owner: req.userId,
      offer,
      request,
      maxDistance: maxDistance || 0
    });
    await marketOffer.save();

    res.status(201).json({ offer: marketOffer });
  } catch (error) {
    next(error);
  }
});

// Aktif teklifler
router.get('/offers', auth, async (req, res, next) => {
  try {
    const offers = await MarketOffer.find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('village', 'name x y')
      .populate('owner', 'username');
    res.json({ offers });
  } catch (error) {
    next(error);
  }
});

// Teklif kabul et
router.post('/accept/:offerId', auth, async (req, res, next) => {
  try {
    const { villageId } = req.body;
    const offer = await MarketOffer.findById(req.params.offerId).populate('village');
    if (!offer || offer.status !== 'active') {
      return res.status(404).json({ error: 'Teklif bulunamadı veya artık aktif değil' });
    }
    if (offer.owner.toString() === req.userId) {
      return res.status(400).json({ error: 'Kendi teklifinizi kabul edemezsiniz' });
    }

    const myVillage = await Village.findById(villageId);
    if (!myVillage || myVillage.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Geçersiz köy' });
    }

    await calculateResources(myVillage);
    if (!hasEnoughResources(myVillage, offer.request)) {
      return res.status(400).json({ error: 'Yetersiz kaynak' });
    }

    // Kaynakları takas et
    deductResources(myVillage, offer.request);
    myVillage.resources.wood += offer.offer.wood || 0;
    myVillage.resources.clay += offer.offer.clay || 0;
    myVillage.resources.iron += offer.offer.iron || 0;
    await myVillage.save();

    // Teklif sahibine kaynakları ver
    const offerVillage = await Village.findById(offer.village._id || offer.village);
    await calculateResources(offerVillage);
    offerVillage.resources.wood += offer.request.wood || 0;
    offerVillage.resources.clay += offer.request.clay || 0;
    offerVillage.resources.iron += offer.request.iron || 0;
    await offerVillage.save();

    offer.status = 'accepted';
    offer.acceptedBy = myVillage._id;
    await offer.save();

    res.json({ message: 'Teklif kabul edildi' });
  } catch (error) {
    next(error);
  }
});

// Teklif iptal
router.delete('/offer/:offerId', auth, async (req, res, next) => {
  try {
    const offer = await MarketOffer.findById(req.params.offerId);
    if (!offer || offer.status !== 'active') {
      return res.status(404).json({ error: 'Teklif bulunamadı' });
    }
    if (offer.owner.toString() !== req.userId) {
      return res.status(403).json({ error: 'Bu teklif size ait değil' });
    }

    // Kaynakları iade et
    const village = await Village.findById(offer.village);
    village.resources.wood += offer.offer.wood || 0;
    village.resources.clay += offer.offer.clay || 0;
    village.resources.iron += offer.offer.iron || 0;
    await village.save();

    offer.status = 'cancelled';
    await offer.save();

    res.json({ message: 'Teklif iptal edildi' });
  } catch (error) {
    next(error);
  }
});

export default router;
