import {
	acquaint,
	genesis,
	intertwined,
	primogem,
	stardust,
	starglitter,
	showBeginner,
	unlimitedFates,
	bannerPhase,
	patchVersion,
	selectedCourse,
	muted,
	notice,
	animeoff
} from '$lib/store/stores';
import { locale } from 'svelte-i18n';
import HistoryIDB from '$lib/store/historyIdb';
import { wishPhase, version } from '$lib/data/wish-setup.json';
import { localConfig } from '$lib/store/localstore';

const { clearIDB } = HistoryIDB;

const clearCacheStorage = async () => {
	localStorage.removeItem('matsuri-offline-pack:genshin');
	const keys = await caches.keys();
	for (const key of keys) {
		const cache = await caches.open(key);
		const requests = await cache.keys();
		await Promise.all(
			requests
				.filter(({ url }) => new URL(url).pathname.startsWith('/gacha-simulator/'))
				.map((request) => cache.delete(request))
		);
	}
	return true;
};

const clearSimulatorStorage = () => {
	const fixedKeys = new Set([
		'beginnerRoll', 'guaranteedStatus', 'version', 'firstshare', 'fatepoint',
		'config', 'outfits', 'welkin', 'storageVersion', 'locale', 'primogem',
		'genesis', 'stardust', 'starglitter', 'intertwined', 'acquaint'
	]);
	for (let index = localStorage.length - 1; index >= 0; index -= 1) {
		const key = localStorage.key(index);
		if (!key) continue;
		if (fixedKeys.has(key) || /(?:4s|5s)Pity$/.test(key)) localStorage.removeItem(key);
	}
};

const factoryReset = async ({ clearCache = false }) => {
	clearSimulatorStorage();
	localConfig.set('animatedBG', true);
	localStorage.setItem('primogem', 1600);
	locale.update((langID) => {
		localStorage.setItem('locale', langID);
		return langID;
	});

	await clearIDB();
	if (clearCache) await clearCacheStorage();

	acquaint.set(0);
	genesis.set(0);
	intertwined.set(0);
	primogem.set(1600);
	stardust.set(0);
	starglitter.set(0);

	selectedCourse.set({});

	showBeginner.set(true);
	bannerPhase.set(wishPhase);
	patchVersion.set(version);

	// Setting
	unlimitedFates.set(false);
	muted.set(false);
	notice.set([]);
	animeoff.set(false);
};

export default factoryReset;
