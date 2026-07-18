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
	getMerchConfig().entries
		.filter(
			(entry) =>
				entry.active !== false && (!bannerId || entry.banner_id === bannerId)
		)
		.map((entry) => ({
		name: entry.product.name,
		bannerId: entry.banner_id,
		rarity: entry.rarity,
		type: entry.kind,
		weaponType: entry.weapon_type || 'sword',
		vision: entry.element || 'anemo',
		weight: entry.weight || 100,
		featured: !!entry.featured,
		isMerch: true,
		imageUrl:
			entry.product.images?.[0] ||
			entry.product.image_variants?.[0]?.detail ||
			'',
		wishBoxPosition: {},
		buttonPosition: {}
	}));

const weightedChoice = (items) => {
	if (!items.length) return null;
	const total = items.reduce((sum, item) => sum + item.weight, 0);
	let cursor = Math.random() * total;
	for (const item of items) {
		cursor -= item.weight;
		if (cursor < 0) return { ...item };
	}
	return { ...items[items.length - 1] };
};

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
	let items = getMerchItems(bannerId).filter((item) => item.rarity === rarity);
	if (!items.length) {
		const sharedItems = getMerchItems().filter((item) => item.rarity === rarity);
		const sharedStandardItems = sharedItems.filter((item) => !item.featured);
		items = sharedStandardItems.length ? sharedStandardItems : sharedItems;
	}
	if (!items.length) return null;

	const featured = items.filter((item) => item.featured);
	const standard = items.filter((item) => !item.featured);
	if (!featured.length || !standard.length) return weightedChoice(items);

	const settings = getMerchConfig().settings || {};
	const configuredRate = Number(settings.featured_item_rate);
	const rate = Math.min(100, Math.max(0, Number.isFinite(configuredRate) ? configuredRate : 50));
	const guaranteeEnabled = settings.featured_guaranteed_after_loss !== false;
	const guaranteeKey = featuredGuaranteeKey(bannerId, rarity);
	const useFeatured =
		(guaranteeEnabled && getGuaranteed(guaranteeKey)) || Math.random() * 100 < rate;
	setGuaranteed(guaranteeKey, guaranteeEnabled && !useFeatured);
	return weightedChoice(useFeatured ? featured : standard);
};
