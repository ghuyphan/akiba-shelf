const emptyConfig = {
	settings: {
		title: 'Matsuri Warp Simulator',
		description: 'Discover characters and Light Cones from this merch shelf.',
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
			itemID: entry.product_id, // items need an ID
			bannerId: entry.banner_id,
			rarity: entry.rarity,
			type: entry.kind === 'weapon' ? 'lightcone' : entry.kind, // map weapon to lightcone
			path: entry.weapon_type || 'destruction', // weapon_type is the Path in HSR
			combat_type: entry.element || 'physical', // element is the combat_type (Element) in HSR
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

export const weightedMerch = (rarity, bannerId) => {
	const items = getMerchItems(bannerId).filter((item) => item.rarity === rarity);
	if (!items.length) return null;
	const total = items.reduce((sum, sumItem) => sum + sumItem.weight, 0);
	let cursor = Math.random() * total;
	for (const item of items) {
		cursor -= item.weight;
		if (cursor < 0) return { ...item };
	}
	return { ...items[items.length - 1] };
};
