import assert from "node:assert/strict";
import {
  availableRarities,
  disclosureForSettings,
  jointRarityRates,
  parseLocalizedText,
  pityChance,
  rarityPool,
  selectPromotedPool,
} from "./gacha-policy.js";

const featured = {
  name: "featured",
  rarity: 5,
  bannerId: "a",
  featured: true,
  weight: 100,
};
const standard = {
  name: "standard",
  rarity: 5,
  bannerId: "a",
  featured: false,
  weight: 100,
};

for (const [rate, random, expected] of [
  [0, 0, false],
  [50, 0.49, true],
  [50, 0.5, false],
  [100, 0.99, true],
]) {
  const result = selectPromotedPool({
    items: [featured, standard],
    featuredRate: rate,
    random: () => random,
  });
  assert.equal(result.promoted, expected, `${rate}% promoted selection`);
}

const loss = selectPromotedPool({
  items: [featured, standard],
  featuredRate: 0,
  random: () => 1,
});
assert.equal(loss.guaranteedNext, true);
const guarantee = selectPromotedPool({
  items: [featured, standard],
  featuredRate: 0,
  guaranteed: loss.guaranteedNext,
  random: () => 1,
});
assert.equal(guarantee.promoted, true);
assert.equal(guarantee.guaranteedNext, false);
assert.throws(
  () =>
    selectPromotedPool({
      items: [featured],
      featuredRate: 50,
      random: () => 1,
    }),
  /non-featured item/,
);
assert.equal(
  selectPromotedPool({ items: [standard], featuredRate: 100 }).promoted,
  false,
);

const globalThree = {
  name: "shared",
  rarity: 3,
  bannerId: "a",
  featured: false,
  weight: 100,
};
assert.deepEqual(
  [...availableRarities([globalThree, { ...standard, bannerId: "b" }], "b")],
  [3, 5],
);
assert.deepEqual(rarityPool([globalThree], "b", 3), [globalThree]);

const pity = { baseRate: 1, softPity: 4, hardPity: 6 };
assert.equal(pityChance({ ...pity, currentPity: 1 }), 1);
assert.ok(pityChance({ ...pity, currentPity: 3 }) > 1);
assert.ok(
  pityChance({ ...pity, currentPity: 4 }) >
    pityChance({ ...pity, currentPity: 3 }),
);
assert.equal(pityChance({ ...pity, currentPity: 5 }), 100);

const characterDisclosure = disclosureForSettings({
  legendary_base_rate: 1.2,
  lightcone_legendary_base_rate: 2.4,
  rare_base_rate: 7,
  legendary_pity: 70,
  lightcone_legendary_pity: 60,
  rare_pity: 9,
  legendary_soft_pity: 50,
  lightcone_legendary_soft_pity: 40,
  rare_soft_pity: 7,
  featured_item_rate: 35,
});
assert.equal(characterDisclosure.base5Rate, 1.2);
assert.equal(characterDisclosure.maxPity, 70);
assert.equal(characterDisclosure.featuredRate, 35);
assert.equal(characterDisclosure.guaranteeEnabled, true);
assert.equal(
  disclosureForSettings({ featured_guaranteed_after_loss: false })
    .guaranteeEnabled,
  false,
);
const lightconeDisclosure = disclosureForSettings(
  {
    lightcone_legendary_base_rate: 2.4,
    lightcone_legendary_pity: 60,
    lightcone_legendary_soft_pity: 40,
  },
  true,
);
assert.equal(lightconeDisclosure.base5Rate, 2.4);
assert.equal(lightconeDisclosure.maxPity, 60);
const jointRates = jointRarityRates({
  base5Rate: 95,
  base4Rate: 95,
  softPity5: 1,
  softPity4: 1,
  hardPity5: 10,
  hardPity4: 2,
});
assert.ok(Math.abs(jointRates.three + jointRates.four + jointRates.five - 100) < 1e-8);
assert.ok(jointRates.four >= 0 && jointRates.five >= 0);

assert.equal(
  parseLocalizedText("[en]English title[vi]Tiêu đề Việt", "en"),
  "English title",
);
assert.equal(
  parseLocalizedText("[en]English title[vi]Tiêu đề Việt", "vi-VN"),
  "Tiêu đề Việt",
);
assert.equal(
  parseLocalizedText("English title | Tiêu đề Việt", "en"),
  "English title",
);
assert.equal(
  parseLocalizedText("English title | Tiêu đề Việt", "vi"),
  "Tiêu đề Việt",
);

console.log("Simulator gacha policy conformance passed.");
