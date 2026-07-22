import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';
import { activeWarp, bannerList, warpList } from '$lib/stores/app-store';
import { getMerchConfig, getMerchItems, parseMerchLocalizedText } from '$lib/helpers/merch';

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

export const initializeBanner = async (version, phase) => {
	try {
		const config = getMerchConfig();
		const activeLocale = get(locale) || 'en';
		const merchLocale =
			typeof window === 'undefined'
				? activeLocale
				: new URLSearchParams(window.location.search).get('locale') || activeLocale;
		const list = (config.banners || [])
			.filter((banner) => banner.active)
			.map((banner) => {
				const poolItems = getMerchItems(banner.id);
				const featuredItems = poolItems.filter((item) => item.featured);
				const displayItems = [...featuredItems]
					.sort((a, b) => b.rarity - a.rarity)
					.slice(0, banner.display_limit || 4);
				const featuredItem =
					displayItems.find((item) => item.rarity === 5) || displayItems[0] || null;
				const displayItem =
					featuredItem || [...poolItems].sort((a, b) => b.rarity - a.rarity)[0] || null;
				const isStandardMerch = featuredItems.length === 0;
				const seenNames = new Set(featuredItem ? [featuredItem.name] : []);
				const rateupItems = [];
				for (const item of displayItems) {
					// Rate-up names feed keyed {#each} blocks, so they must be unique:
					// several entries can reference the same or identically named products.
					if (item.rarity !== 4 || seenNames.has(item.name)) continue;
					seenNames.add(item.name);
					rateupItems.push(item);
					if (rateupItems.length >= 3) break;
				}
				return {
					isMerch: true,
					isStandardMerch,
					bannerName: parseMerchLocalizedText(banner.name, merchLocale),
					featured: featuredItem?.name || '',
					displayItem: displayItem?.name || '',
					runNumber: 1,
					type:
						banner.kind === 'weapon' || banner.kind === 'lightcone'
							? 'lightcone-event'
							: 'character-event',
					path: displayItem?.path || 'destruction',
					combat_type: banner.theme || displayItem?.combat_type || 'physical',
					rateup: rateupItems.map((item) => item.name),
					bannerID: banner.id,
					endsAt: banner.ends_at || null,
					merchItems: poolItems,
					description: parseMerchLocalizedText(
						banner.description || config.settings.description,
						merchLocale
					)
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
