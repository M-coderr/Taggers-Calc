var PROCESS_RATES = {
  printing: {
    offsetBase: 2000,
    offsetSlabIncrement: 350,
    handPerColor: 500,
  },
  lamination: {
    ratePerSqIn: 0.004,
  },
  die: {
    tiers: [
      { maxL: 10, maxW: 10, label: 'Up to 10" x 10"', dieCost: 1000, runRate: 500 },
      { maxL: 14, maxW: 20, label: 'Up to 14" x 20"', dieCost: 1800, runRate: 500 },
      { maxL: Infinity, maxW: Infinity, label: 'Bigger than 14" x 20"', dieCost: 2800, runRate: 750 },
    ],
  },
  slab: {
    base: 1000,
    grace: 200,
  },
};
