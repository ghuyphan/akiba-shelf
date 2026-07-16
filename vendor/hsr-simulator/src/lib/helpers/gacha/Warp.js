import { roll } from './roll';
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
		const distanceA = Math.abs(a - requestedRarity);
		const distanceB = Math.abs(b - requestedRarity);

		if (distanceA !== distanceB) {
			return distanceA - distanceB;
		}

		return a - b;
	})[0];
};

const WARP = {
	async init() {
		return this;
	},

	getItem(rarity, banner, bannerId) {
		const activeBanners = getMerchBanners().filter(
			(item) => item?.active !== false && Boolean(item?.id)
		);

		const selectedBanner =
			activeBanners.find((item) => item.id === bannerId) ?? activeBanners[0] ?? null;

		if (!selectedBanner) {
			throw new Error('No active HSR banner is available.');
		}

		const bannerItems = getMerchItems(selectedBanner.id);

		if (bannerItems.length === 0) {
			throw new Error(
				`HSR banner "${selectedBanner.name || selectedBanner.id}" has no active products.`
			);
		}

		let result = weightedMerch(rarity, selectedBanner.id);

		if (!result) {
			const fallbackRarity = getClosestAvailableRarity(bannerItems, rarity);

			if (fallbackRarity !== null) {
				result = weightedMerch(fallbackRarity, selectedBanner.id);
			}
		}

		if (!result?.itemID) {
			throw new Error(
				`Could not select a valid product from HSR banner "${selectedBanner.name || selectedBanner.id}".`
			);
		}

		const date = new Date();

		return {
			...result,
			banner,
			bannerID: selectedBanner.id,
			bannerId: selectedBanner.id,
			bannerName: selectedBanner.name || 'Matsuri Warp',
			status: result.featured ? 'win' : null,
			time: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
		};
	}
};

export default WARP;
export { roll };
