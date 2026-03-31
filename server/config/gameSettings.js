const gameSettings = {
  worldSpeed: 1,
  unitSpeed: 1,
  worldSize: 500,

  startingResources: {
    wood: 500,
    clay: 500,
    iron: 500
  },

  maxBuildQueue: 2,
  maxTroopQueue: 5,

  beginnerProtectionHours: 72,

  morale: {
    enabled: true,
    minPoints: 50
  },

  noble: {
    loyaltyMin: 20,
    loyaltyMax: 35,
    goldCoinCost: 1
  },

  barbarianVillagePercent: 30,
  barbarianMaxLevel: 5,

  clanMemberLimit: 50,

  marketMerchants: 10,
  merchantCapacity: 1000,

  tick: {
    intervalMs: 1000,
    resourceCalculationMode: 'lazy'
  }
};

export default gameSettings;
