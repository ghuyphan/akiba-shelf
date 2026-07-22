const finiteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const clampRate = (value, fallback) =>
  Math.min(100, Math.max(0, finiteNumber(value, fallback)));

export const normalizePity = (value, fallback, minimum = 1) =>
  Math.max(minimum, Math.trunc(finiteNumber(value, fallback)));

export const pityChance = ({ baseRate, currentPity, softPity, hardPity }) => {
  const base = clampRate(baseRate, 0);
  const hard = normalizePity(hardPity, 1);
  const soft = Math.min(normalizePity(softPity, hard - 1), hard - 1);
  const nextPull = Math.max(1, Math.trunc(finiteNumber(currentPity, 0)) + 1);
  if (nextPull >= hard) return 100;
  if (nextPull < soft) return base;
  const increase = (100 - base) / (hard + 1 - soft);
  return Math.min(100, base + (nextPull + 1 - soft) * increase);
};

export const rarityPool = (items, bannerId, rarity) =>
  items.filter(
    (item) =>
      item.rarity === rarity && (rarity === 3 || item.bannerId === bannerId),
  );

export const availableRarities = (items, bannerId) =>
  new Set(
    [3, 4, 5].filter((rarity) => rarityPool(items, bannerId, rarity).length),
  );

export const weightedChoice = (items, random = Math.random) => {
  if (!items.length) return null;
  const total = items.reduce(
    (sum, item) => sum + Math.max(0, finiteNumber(item.weight, 0)),
    0,
  );
  if (total <= 0) return { ...items[0] };
  let cursor = random() * total;
  for (const item of items) {
    cursor -= Math.max(0, finiteNumber(item.weight, 0));
    if (cursor < 0) return { ...item };
  }
  return { ...items[items.length - 1] };
};

export const selectPromotedPool = ({
  items,
  featuredRate,
  guaranteed = false,
  guaranteeEnabled = true,
  random = Math.random,
}) => {
  const featured = items.filter((item) => item.featured);
  const standard = items.filter((item) => !item.featured);
  if (!featured.length)
    return { items: standard, guaranteedNext: false, promoted: false };

  const rate = clampRate(featuredRate, 50);
  const promoted =
    guaranteed || rate >= 100 || (rate > 0 && random() * 100 < rate);
  if (promoted) {
    return { items: featured, guaranteedNext: false, promoted: true };
  }
  if (!standard.length) {
    throw new Error(
      "This banner needs a non-featured item for a possible featured-rate loss.",
    );
  }
  return {
    items: standard,
    guaranteedNext: guaranteeEnabled,
    promoted: false,
  };
};

export const effectiveRarityRate = ({ baseRate, softPity, hardPity }) => {
  const hard = normalizePity(hardPity, 1);
  let survival = 1;
  let expectedPulls = 0;
  for (let currentPity = 0; currentPity < hard; currentPity += 1) {
    expectedPulls += survival;
    const chance =
      pityChance({ baseRate, currentPity, softPity, hardPity: hard }) / 100;
    survival *= 1 - chance;
  }
  return expectedPulls > 0 ? 100 / expectedPulls : 100;
};

export const jointRarityRates = ({
  base5Rate,
  base4Rate,
  softPity5,
  softPity4,
  hardPity5,
  hardPity4,
}) => {
  const max5 = normalizePity(hardPity5, 90);
  const max4 = normalizePity(hardPity4, 10);
  const width = max4 + 1;
  const size = (max5 + 1) * width;
  let distribution = new Float64Array(size);
  distribution[0] = 1;

  const probabilities = (pity5, pity4) => {
    let five = pityChance({
      baseRate: base5Rate,
      currentPity: pity5,
      softPity: softPity5,
      hardPity: max5,
    });
    let four = pityChance({
      baseRate: base4Rate,
      currentPity: pity4,
      softPity: softPity4,
      hardPity: max4,
    });
    let three = 100 - four - five;
    if (three < 0 && five >= 100) four = 0;
    if (three < 0) three = 0;
    if (four >= 100) five = 0;
    const total = three + four + five;
    return total > 0
      ? [three / total, four / total, five / total]
      : [0, 0, 1];
  };

  for (let iteration = 0; iteration < 4000; iteration += 1) {
    const next = new Float64Array(size);
    for (let pity5 = 0; pity5 <= max5; pity5 += 1) {
      for (let pity4 = 0; pity4 <= max4; pity4 += 1) {
        const state = pity5 * width + pity4;
        const mass = distribution[state];
        if (mass === 0) continue;
        const [three, four, five] = probabilities(pity5, pity4);
        next[Math.min(max5, pity5 + 1) * width + Math.min(max4, pity4 + 1)] +=
          mass * three;
        next[Math.min(max5, pity5 + 1) * width] += mass * four;
        next[Math.min(max4, pity4 + 1)] += mass * five;
      }
    }
    let difference = 0;
    for (let index = 0; index < size; index += 1) {
      difference += Math.abs(next[index] - distribution[index]);
    }
    distribution = next;
    if (iteration > 50 && difference < 1e-12) break;
  }

  const rates = [0, 0, 0];
  for (let pity5 = 0; pity5 <= max5; pity5 += 1) {
    for (let pity4 = 0; pity4 <= max4; pity4 += 1) {
      const mass = distribution[pity5 * width + pity4];
      const probabilitiesForState = probabilities(pity5, pity4);
      rates[0] += mass * probabilitiesForState[0];
      rates[1] += mass * probabilitiesForState[1];
      rates[2] += mass * probabilitiesForState[2];
    }
  }
  return {
    three: rates[0] * 100,
    four: rates[1] * 100,
    five: rates[2] * 100,
  };
};

export const disclosureForSettings = (settings = {}, gearBanner = false) => {
  const base5Rate = clampRate(
    gearBanner
      ? settings.lightcone_legendary_base_rate
      : settings.legendary_base_rate,
    gearBanner ? 0.8 : 0.6,
  );
  const base4Rate = clampRate(settings.rare_base_rate, 5.1);
  const maxPity = normalizePity(
    gearBanner ? settings.lightcone_legendary_pity : settings.legendary_pity,
    gearBanner ? 80 : 90,
  );
  const maxPity4 = normalizePity(settings.rare_pity, 10);
  const softPity = Math.min(
    normalizePity(
      gearBanner
        ? settings.lightcone_legendary_soft_pity
        : settings.legendary_soft_pity,
      maxPity - 1,
    ),
    maxPity - 1,
  );
  const softPity4 = Math.min(
    normalizePity(settings.rare_soft_pity, maxPity4 - 1),
    maxPity4 - 1,
  );
  const consolidated = jointRarityRates({
    base5Rate,
    base4Rate,
    softPity5: softPity,
    softPity4,
    hardPity5: maxPity,
    hardPity4: maxPity4,
  });
  return {
    base5Rate,
    base4Rate,
    consolidated5Rate: consolidated.five,
    consolidated4Rate: consolidated.four,
    consolidated3Rate: consolidated.three,
    featuredRate: clampRate(settings.featured_item_rate, 50),
    maxPity,
    maxPity4,
    softPity,
    softPity4,
    guaranteeEnabled: settings.featured_guaranteed_after_loss !== false,
  };
};

export const parseLocalizedText = (value, locale = "en") => {
  if (!value) return "";
  const text = String(value).trim();
  const en = text.match(/\[en\]([\s\S]*?)(?=\[vi\]|$)/i)?.[1]?.trim();
  const vi = text.match(/\[vi\]([\s\S]*?)(?=\[en\]|$)/i)?.[1]?.trim();
  if (en || vi)
    return locale.toLowerCase().startsWith("vi")
      ? vi || en || ""
      : en || vi || "";
  if (text.includes("|")) {
    const [english = "", vietnamese = ""] = text
      .split("|", 2)
      .map((part) => part.trim());
    return locale.toLowerCase().startsWith("vi")
      ? vietnamese || english
      : english || vietnamese;
  }
  return text;
};
