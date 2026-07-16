import { roll } from './roll';
import { getMerchBanners, weightedMerch } from '$lib/helpers/merch';

const WARP = {
	async init(version, phase) {
		return this;
	},

	getItem(rarity, banner, indexOfBanner = 0) {
		const activeBanners = getMerchBanners().filter((item) => item.active);
		const selectedBanner = activeBanners[indexOfBanner];
		const result = weightedMerch(rarity, selectedBanner?.id);
		if (!result) return { type: null, rarity: 0, name: null };
		result.bannerName = selectedBanner?.name || 'Matsuri Warp';
		result.status = result.featured ? 'win' : null;

		const date = new Date();
		result.time = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
		return result;
	}
};

export default WARP;
export { roll };
