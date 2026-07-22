import {
	availableRarities,
	disclosureForSettings,
	parseLocalizedText,
	pityChance,
	rarityPool,
	selectPromotedPool,
	weightedChoice
} from '../../../../shared/gacha-policy.js';

const emptyConfig = {
	settings: {
		title: 'Matsuri Wish Simulator',
		description: 'Discover characters and weapons from this merch shelf.',
		rare_base_rate: 5.1,
		legendary_base_rate: 0.6,
		lightcone_legendary_base_rate: 0.8,
		rare_soft_pity: 9,
		legendary_soft_pity: 49,
		lightcone_legendary_soft_pity: 79,
		featured_item_rate: 50,
		featured_guaranteed_after_loss: true,
		rare_pity: 10,
		legendary_pity: 50
	},
	banners: [],
	entries: []
};

const shopSlug = () => {
	if (typeof window === 'undefined') return '';
	return new URLSearchParams(window.location.search).get('shop') || '';
};

export const getMerchConfig = () => {
	if (typeof window === 'undefined') return emptyConfig;
	try {
		const stored = localStorage.getItem(`matsuri-gacha-config:${shopSlug()}`);
		const parsed = JSON.parse(stored || 'null');
		if (!parsed || !Array.isArray(parsed.entries)) return emptyConfig;
		return parsed;
	} catch {
		return emptyConfig;
	}
};

export const getMerchBanners = () => getMerchConfig().banners || [];

export const getMerchItems = (bannerId) =>
	getMerchConfig()
		.entries.filter(
			(entry) =>
				entry.active !== false && (!bannerId || entry.rarity === 3 || entry.banner_id === bannerId)
		)
		.map((entry) => ({
			name: entry.product.name,
			itemID: entry.product_id,
			bannerId: entry.banner_id,
			rarity: entry.rarity,
			type: entry.kind,
			weaponType: entry.weapon_type || 'sword',
			vision: entry.element || 'anemo',
			weight: entry.weight || 100,
			featured: !!entry.featured,
			isMerch: true,
			imageUrl: entry.product.images?.[0] || entry.product.image_variants?.[0]?.detail || '',
			wishBoxPosition: {},
			buttonPosition: {}
		}));
const featuredGuaranteeKey = (bannerId, rarity) =>
	`matsuri-gacha-featured-guarantee:${shopSlug()}:${bannerId}:${rarity}`;

const getGuaranteed = (key) => {
	if (typeof window === 'undefined') return false;
	try {
		return localStorage.getItem(key) === '1';
	} catch {
		return false;
	}
};

const setGuaranteed = (key, guaranteed) => {
	if (typeof window === 'undefined') return;
	try {
		if (guaranteed) localStorage.setItem(key, '1');
		else localStorage.removeItem(key);
	} catch {
		// The roll still succeeds when storage is unavailable.
	}
};

export const weightedMerch = (rarity, bannerId) => {
	const items = rarityPool(getMerchItems(), bannerId, rarity);
	if (!items.length) return null;
	const settings = getMerchConfig().settings || {};
	const guaranteeEnabled = settings.featured_guaranteed_after_loss !== false;
	const guaranteeKey = featuredGuaranteeKey(bannerId, rarity);
	const selected = selectPromotedPool({
		items,
		featuredRate: settings.featured_item_rate,
		guaranteed: guaranteeEnabled && getGuaranteed(guaranteeKey),
		guaranteeEnabled
	});
	setGuaranteed(guaranteeKey, selected.guaranteedNext);
	return weightedChoice(selected.items);
};

export const getMerchAvailability = (bannerId) => availableRarities(getMerchItems(), bannerId);
export const getMerchDisclosure = (gearBanner = false) =>
	disclosureForSettings(getMerchConfig().settings || {}, gearBanner);
export const getMerchPityChance = pityChance;
export const parseMerchLocalizedText = parseLocalizedText;
