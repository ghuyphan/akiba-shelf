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
		title: 'Matsuri Warp Simulator',
		description: 'Discover characters and Light Cones from this merch shelf.',
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

export const getMerchLocale = () => {
	if (typeof window === 'undefined') return 'en';
	return new URLSearchParams(window.location.search).get('locale') || 'en';
};

export const getMerchDisclosureCopy = (locale = getMerchLocale()) => {
	if (locale.toLowerCase().startsWith('vi')) {
		return {
			standardPool:
				'Warp merch tiêu chuẩn này không có vật phẩm nổi bật. Mọi vật phẩm 4 sao và 5 sao đang bật trong banner được chọn từ pool tiêu chuẩn theo tỷ lệ và bảo hiểm đã cấu hình.',
			ratesTitle: 'Tỷ lệ Warp merch đã cấu hình',
			fiveStar: ({ base5Rate, softPity, maxPity, consolidated5Rate }) =>
				`Tỷ lệ cơ bản nhận vật phẩm 5 sao là ${base5Rate}, bắt đầu tăng từ lượt ${softPity} và chắc chắn nhận vật phẩm 5 sao chậm nhất ở lượt ${maxPity}. Tỷ lệ tổng hợp ước tính là ${consolidated5Rate}.`,
			fourStar: ({ base4Rate, softPity4, maxPity4, consolidated4Rate }) =>
				`Tỷ lệ cơ bản nhận vật phẩm 4 sao là ${base4Rate}, bắt đầu tăng từ lượt ${softPity4} và chắc chắn nhận vật phẩm 4 sao trở lên chậm nhất ở lượt ${maxPity4}. Tỷ lệ tổng hợp ước tính là ${consolidated4Rate}.`,
			promoted: ({ featuredRate, guaranteeEnabled }) =>
				`Khi pool có cả vật phẩm nổi bật và tiêu chuẩn, cơ hội chọn vật phẩm nổi bật ở độ hiếm tương ứng là ${featuredRate}. ${
					guaranteeEnabled
						? 'Nếu nhận vật phẩm tiêu chuẩn, kết quả tiếp theo ở độ hiếm đó chắc chắn là vật phẩm nổi bật.'
						: 'Không bật quy tắc bảo hiểm vật phẩm nổi bật sau khi trượt.'
				}`,
			selection:
				'Phần thưởng được chọn từ pool merch đang hoạt động và trọng số vật phẩm của banner này; hệ thống không giả định tỷ lệ nhân vật so với Light Cone theo game chính thức.'
		};
	}
	return {
		standardPool:
			'This standard merch Warp has no featured items. Every active 4-star and 5-star item in this banner is selected from the standard pool using the configured rates and pity.',
		ratesTitle: 'Configured merch Warp rates',
		fiveStar: ({ base5Rate, softPity, maxPity, consolidated5Rate }) =>
			`The base 5-star chance is ${base5Rate}, with rate increases starting at pull ${softPity} and a guaranteed 5-star by pull ${maxPity}. The calculated consolidated chance is ${consolidated5Rate}.`,
		fourStar: ({ base4Rate, softPity4, maxPity4, consolidated4Rate }) =>
			`The base 4-star chance is ${base4Rate}, with rate increases starting at pull ${softPity4} and a guaranteed 4-star or above by pull ${maxPity4}. The calculated consolidated chance is ${consolidated4Rate}.`,
		promoted: ({ featuredRate, guaranteeEnabled }) =>
			`When both promoted and standard candidates exist, the promoted selection chance is ${featuredRate} for the selected rarity. ${
				guaranteeEnabled
					? 'A standard result guarantees that the next result of that rarity is promoted.'
					: 'No guarantee-after-loss rule is enabled.'
			}`,
		selection:
			"Reward selection follows this banner's active merchant pool and configured item weights; no official character-versus-Light-Cone split is assumed."
	};
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
			itemID: entry.product_id, // items need an ID
			bannerId: entry.banner_id,
			rarity: entry.rarity,
			type: entry.kind === 'weapon' ? 'lightcone' : entry.kind, // map weapon to lightcone
			path: entry.weapon_type || 'destruction', // weapon_type is the Path in HSR
			combat_type: entry.element || 'physical', // element is the combat_type (Element) in HSR
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
