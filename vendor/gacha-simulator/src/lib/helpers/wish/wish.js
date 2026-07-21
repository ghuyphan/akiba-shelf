import roll from './roll';
import { getMerchBanners, getMerchItems, weightedMerch } from '$lib/helpers/merch';

const getClosestAvailableRarity = (items, requestedRarity) => {
	const rarities = [
		...new Set(
			items
				.map((item) => Number(item.rarity))
				.filter((rarity) => rarity === 3 || rarity === 4 || rarity === 5)
		)
	];

	if (rarities.length === 0) return null;
	return rarities.sort((a, b) => {
		const distance = Math.abs(a - requestedRarity) - Math.abs(b - requestedRarity);
		return distance || a - b;
	})[0];
};

const Wish = {
	async init() {
		return this;
	},

	getItem(rarity, banner, indexOfBanner = 0) {
		const activeBanners = getMerchBanners().filter((item) => item.active);
		const selectedBanner = activeBanners[indexOfBanner];
		if (!selectedBanner) return { type: null, rarity: 0, name: null };

		const bannerItems = getMerchItems(selectedBanner.id);
		let result = weightedMerch(rarity, selectedBanner.id);
		if (!result) {
			const fallbackRarity = getClosestAvailableRarity(bannerItems, rarity);
			if (fallbackRarity !== null) result = weightedMerch(fallbackRarity, selectedBanner.id);
		}
		if (!result) return { type: null, rarity: 0, name: null };
		result.bannerName = selectedBanner?.name || 'Matsuri Shelf Wishes';
		result.status = result.featured ? 'win' : null;

		const date = new Date();
		result.time = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
		return result;
	}
};

export { roll };
export default Wish;
