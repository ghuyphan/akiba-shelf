import HistoryIDB from '$lib/store/historyIdb';
import { pity4star, pity5star } from '$lib/store/localstore';
import prob from './prob';
import { getMerchConfig, getMerchItems } from '$lib/helpers/merch';

const { addHistory, countItem } = HistoryIDB;

const configuredRate = (value, fallback) => {
	const rate = Number(value);
	return Number.isFinite(rate) && rate > 0 && rate < 100 ? rate : fallback;
};

const pityRate = ({ baseRate, currentPity, softPity, hardPity }) => {
	const nextPull = currentPity + 1;
	if (nextPull >= hardPity) return 100;
	if (nextPull < softPity) return baseRate;
	const increase = (100 - baseRate) / (hardPity + 1 - softPity);
	return Math.min(100, baseRate + (nextPull + 1 - softPity) * increase);
};

/**
 * Roll and get result for the selected Banner
 * @param {string} banner Wich banner to do roll
 * @param {number} indexOfBanner Index Of active banner among the dual banner
 * @param {Object} WishInstance Wish Instance, init first, then put as argument here
 * @returns Wish Result Object
 */
const roll = async (banner, indexOfBanner, WishInstance) => {
	const pity4 = pity4star.get(banner);
	const pity5 = pity5star.get(banner);
	const { settings } = getMerchConfig();
	const base5star = configuredRate(settings.legendary_base_rate, 0.6);
	const base4star = configuredRate(settings.rare_base_rate, 5.1);
	const hardPity5 = Number(settings.legendary_pity) || 50;
	const hardPity4 = Number(settings.rare_pity) || 10;
	const softPity5 = Math.min(Number(settings.legendary_soft_pity) || hardPity5 - 1, hardPity5 - 1);
	const softPity4 = Math.min(Number(settings.rare_soft_pity) || hardPity4 - 1, hardPity4 - 1);
	const bannerId = getMerchConfig().banners?.filter((item) => item.active)[indexOfBanner]?.id;
	const available = new Set(getMerchItems(bannerId).map(({ rarity }) => rarity));
	const chance5star = !available.has(5)
		? 0
		: pityRate({ baseRate: base5star, currentPity: pity5, softPity: softPity5, hardPity: hardPity5 });
	let chance4star = !available.has(4)
		? 0
		: pityRate({ baseRate: base4star, currentPity: pity4, softPity: softPity4, hardPity: hardPity4 });
	let chance3star = 100 - chance4star - chance5star;

	if (!available.has(3)) chance3star = 0;
	if (chance5star >= 100) chance4star = 0;
	if (chance3star < 0) chance3star = 0;
	if (chance3star + chance4star + chance5star === 0) {
		throw new Error('This wish shelf has no active merch.');
	}

	const item = [
		{
			rarity: 3,
			chance: chance3star
		},
		{
			rarity: 4,
			chance: chance4star
		},
		{
			rarity: 5,
			chance: chance5star
		}
	];

	const { rarity } = prob(item);
	let pity = 1;

	if (rarity === 5) {
		pity4star.set(banner, pity4 + 1);
		pity5star.set(banner, 0);
		pity = pity5 + 1;
	}

	if (rarity === 4) {
		pity4star.set(banner, 0);
		pity5star.set(banner, pity5 + 1);
		pity = pity4 + 1;
	}

	if (rarity === 3) {
		pity4star.set(banner, pity4 + 1);
		pity5star.set(banner, pity5 + 1);
	}

	const Wish = await WishInstance;
	const wishResult = Wish.getItem(rarity, banner, indexOfBanner);
	wishResult.pity = pity;
	wishResult.banner = banner;

	const numberOfItemOfHistory = await countItem(wishResult.name);
	await addHistory(wishResult);

	const isFullConstellation = numberOfItemOfHistory > 6;
	const result = { ...wishResult, isNew: numberOfItemOfHistory < 1 };
	if (result.type === 'character' && numberOfItemOfHistory > 0 && result.rarity >= 4) {
		result.stelaFortuna = !isFullConstellation;
	}
	result.fateType = result.rarity === 3 ? 'stardust' : 'starglitter';
	result.fateQty = getMilestoneQty(
		result.rarity,
		result.type,
		isFullConstellation,
		result.isNew
	);
	return result;
};

const getMilestoneQty = (rarity, type, isFullConstellation, isNew) => {
	if (type === 'weapon') {
		if (rarity === 3) return 15;
		if (rarity === 4) return 2;
		return 10;
	}
	if (isNew) return 0;
	if (rarity === 4) return isFullConstellation ? 5 : 2;
	return isFullConstellation ? 25 : 10;
};

export default roll;
