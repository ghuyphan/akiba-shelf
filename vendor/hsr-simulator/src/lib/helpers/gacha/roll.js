import { regReward, starterRemaining } from '$lib/stores/app-store';
import { HistoryManager } from '$lib/helpers/dataAPI/api-indexeddb';
import {
	guaranteedStatus,
	localPity,
	owneditem,
	rollCounter
} from '$lib/helpers/dataAPI/api-localstorage';
import { prob, getRate } from './probabilities';
import {
	getMerchAvailability,
	getMerchBanners,
	getMerchConfig,
	getMerchPityChance
} from '$lib/helpers/merch';

const { addHistory } = HistoryManager;

export const roll = async (banner, WarpInstance, indexOfBanner) => {
	const storedPity5 = localPity.get(`pity5${banner}`);
	const storedPity4 = localPity.get(`pity4${banner}`);
	const pity5 = storedPity5 + 1;
	const pity4 = storedPity4 + 1;
	const settings = getMerchConfig().settings || {};
	const configuredLegendaryPity = banner.includes('lightcone')
		? settings.lightcone_legendary_pity
		: settings.legendary_pity;
	const configuredLegendaryRate = banner.includes('lightcone')
		? settings.lightcone_legendary_base_rate
		: settings.legendary_base_rate;
	const maxPity = Number(configuredLegendaryPity) || getRate(banner, 'max5');
	const maxPity4 = Number(settings.rare_pity) || getRate(banner, 'max4');
	const configuredSoftPity = banner.includes('lightcone')
		? settings.lightcone_legendary_soft_pity
		: settings.legendary_soft_pity;
	const softPity5 = Math.min(
		Math.max(1, Number(configuredSoftPity) || getRate(banner, 'hard5')),
		maxPity - 1
	);
	const softPity4 = Math.min(
		Math.max(1, Number(settings.rare_soft_pity) || getRate(banner, 'hard4')),
		maxPity4 - 1
	);
	const baseRate5 = Number.isFinite(Number(configuredLegendaryRate))
		? Number(configuredLegendaryRate)
		: getRate(banner, 'baseRate5');
	const baseRate4 = Number.isFinite(Number(settings.rare_base_rate))
		? Number(settings.rare_base_rate)
		: getRate(banner, 'baseRate4');
	const bannerId = getMerchBanners().filter((item) => item.active)[indexOfBanner]?.id;
	const available = getMerchAvailability(bannerId);

	let chance5star = !available.has(5)
		? 0
		: getMerchPityChance({
				baseRate: baseRate5,
				currentPity: storedPity5,
				softPity: softPity5,
				hardPity: maxPity
			});
	let chance4star = !available.has(4)
		? 0
		: getMerchPityChance({
				baseRate: baseRate4,
				currentPity: storedPity4,
				softPity: softPity4,
				hardPity: maxPity4
			});
	let chance3star = 100 - chance4star - chance5star;

	if (!available.has(3)) chance3star = 0;
	if ((chance3star < 0 && pity5 >= maxPity) || chance5star === 100) chance4star = 0;
	if (chance3star < 0) chance3star = 0;
	if (chance4star === 100) chance5star = 0;
	if (chance3star + chance4star + chance5star === 0) {
		throw new Error('This warp shelf has no active merch.');
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

	let { rarity } = prob(item);
	let pity = 1;

	const rollQty = rollCounter.get(banner);
	rollCounter.set(banner, rollQty + 1);

	if (banner === 'starter') {
		// starter banner limited 50 pulls
		const isAlreadyGet5star = guaranteedStatus.get('starter');
		const isGuaranteed50pull = rollQty === 49 && !isAlreadyGet5star;
		if (isGuaranteed50pull) rarity = 5;
		starterRemaining.update((v) => v - 1);
	}

	// 300th pulls on regular banner, pick a character
	if (rollQty <= 300 && banner === 'regular') {
		regReward.update(({ isClaimed }) => ({ rollcount: rollQty + 1, isClaimed }));
	}

	if (rarity === 5) {
		localPity.set(`pity4${banner}`, pity4);
		localPity.set(`pity5${banner}`, 0);
		pity = pity5;
	}

	if (rarity === 4) {
		localPity.set(`pity4${banner}`, 0);
		localPity.set(`pity5${banner}`, pity5);
		pity = pity4;
	}

	if (rarity === 3) {
		localPity.set(`pity4${banner}`, pity4);
		localPity.set(`pity5${banner}`, pity5);
	}

	// Get Item
	const randomItem = WarpInstance.getItem(rarity, banner, indexOfBanner);

	if (!randomItem?.itemID) {
		throw new Error(
			`HSR roll returned an invalid item for banner "${indexOfBanner}" and rarity ${rarity}.`
		);
	}

	const { manual, warp } = owneditem.put({ itemID: randomItem.itemID });
	const numberOfOwnedItem = manual + warp - 1;
	const isNew = numberOfOwnedItem < 1;

	// storing item to storage
	await saveResult({ pity, ...randomItem });

	// Set Eidolon
	const isFullEidolon = numberOfOwnedItem > 6;
	if (randomItem.type === 'character' && !isNew) {
		randomItem.eidolon = !isFullEidolon;
	}

	// Undying Counter
	const undyingType = randomItem.rarity === 3 ? 'embers' : 'starlight';
	const undyingQty = getMilestoneQty(randomItem.rarity, randomItem.type, isFullEidolon, isNew);

	const result = { pity, isNew, undyingQty, undyingType, ...randomItem };
	return result;
};

const getMilestoneQty = (rarity, type, isFullEidolon, isNew) => {
	// Always give bonus on obtaining lightcone
	if (type === 'lightcone') {
		if (rarity === 3) return 20; // *3
		if (rarity === 4) return 8; // *4
		return 40; // *5
	}

	// Don't give bonus to newly obtained character
	if (isNew) return 0;

	// Give starlight for duplicate characters
	if (rarity === 4) return isFullEidolon ? 20 : 8; // *4
	return isFullEidolon ? 100 : 40; // *5
};

const saveResult = async (result) => {
	// await addHistory()

	const data = { ...result };
	delete data.buttonOffset;
	delete data.splashartOffset;
	delete data.gachaCardOffset;
	delete data.bannerOffset;
	delete data.animationID;

	await addHistory(data);
};
