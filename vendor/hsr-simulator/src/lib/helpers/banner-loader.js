import { get } from 'svelte/store';
import { activeWarp, bannerList, warpList } from '$lib/stores/app-store';
import { getMerchConfig, getMerchItems } from '$lib/helpers/merch';

export const identifyBanner = (bnid = '0-0') => {
	const list = get(warpList) || [];
	const banner = list.find((b) => b.bannerID === bnid);
	if (banner) {
		return {
			type: banner.type,
			bannerName: banner.bannerName,
			featured: banner.featured,
			runNumber: banner.runNumber
		};
	}
	return { type: 'character-event', bannerName: 'Matsuri Shelf Warp', featured: '', runNumber: 1 };
};

const parseEnglishText = (str) => {
	if (!str) return '';
	if (str.includes('[en]')) {
		const match = str.match(/\[en\](.*?)(\[vi\]|$)/i);
		if (match && match[1]) {
			return match[1].trim();
		}
	}
	if (str.includes('|')) {
		return str.split('|')[0].trim();
	}
	return str.trim();
};

export const initializeBanner = async (version, phase) => {
	try {
		const config = getMerchConfig();
		const list = (config.banners || []).filter((banner) => banner.active).map((banner) => {
			const poolItems = getMerchItems(banner.id);
			const featuredItems = poolItems.filter((item) => item.featured);
			const displayItems = [...(featuredItems.length ? featuredItems : poolItems)]
				.sort((a, b) => b.rarity - a.rarity)
				.slice(0, banner.display_limit || 3);
			const featuredItem = displayItems[0] || poolItems[0];
			return {
				isMerch: true,
				bannerName: parseEnglishText(banner.name),
				featured: featuredItem?.name || '',
				runNumber: 1,
				type: (banner.kind === 'weapon' || banner.kind === 'lightcone') ? 'lightcone-event' : 'character-event',
				path: featuredItem?.path || 'destruction',
				combat_type: banner.theme || featuredItem?.combat_type || 'physical',
				rateup: displayItems.map((item) => item.name),
				bannerID: banner.id,
				merchItems: displayItems,
				description: parseEnglishText(banner.description || config.settings.description)
			};
		});

		bannerList.set(list);
		setFlattenWarpList(list);

		return { status: 'ok' };
	} catch (e) {
		console.error(e);
		return { status: 'error', e };
	}
};

const setFlattenWarpList = (list = []) => {
	const ls = [];
	list.forEach((warp) => {
		if (warp.type && warp.type.match('group')) {
			warp.content.forEach((w) => ls.push(w));
		} else {
			ls.push(warp);
		}
	});
	warpList.set(ls);
};

export const setActiveWarp = (list, activeIndex, indexInGroup = 0) => {
	const activeBanner = list[activeIndex];
	if (!activeBanner) return;
	if (!activeBanner.type.match('group')) return activeWarp.set(activeBanner);

	// If grouped banner
	const index = indexInGroup >= activeBanner.content.length ? 0 : indexInGroup;
	const active = activeBanner.content[index];
	activeWarp.set(active);
};

export const handleShowStarter = (show) => {
	return;
};
