<script>
	import { getContext, onDestroy, onMount, setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { playSfx } from '$lib/helpers/audio/audio.svelte';
	import {
		pageActive,
		bannerList,
		backsound,
		patchVersion,
		bannerPhase,
		showBeginner,
		isFatepointSystem,
		muted,
		bannerActive,
		isAcquaintUsed,
		assets
	} from '$lib/store/stores';
	import { localConfig, localWelkin } from '$lib/store/localstore';
	import beginnerConfig from '$lib/data/banners/beginner.json';
	import { getMerchConfig, getMerchItems } from '$lib/helpers/merch';
	import { checkLightweight } from '$lib/helpers/lightweight';

	// Components
	import MainWish from '$lib/components/wish/MainWish.svelte';
	import Toast from '$lib/components/utility/Toast.svelte';

	let GachaInfo;
	let MainShop;
	let MainInventory;
	let Obtained;
	let WelkinCheckin;
	let setBannerVersionAndPhase;

	const importChunks = async () => {
		const [gachaInfo, mainShop, mainInventory, obtained, welkinCheckin] = await Promise.all([
			import('$lib/components/gachainfo/GachaInfo.svelte'),
			import('$lib/components/shop/MainShop.svelte'),
			import('$lib/components/inventory/MainInventory.svelte'),
			import('$lib/components/utility/Obtained.svelte'),
			import('$lib/components/utility/WelkinCheckin.svelte')
		]);
		GachaInfo = gachaInfo.default;
		MainShop = mainShop.default;
		MainInventory = mainInventory.default;
		Obtained = obtained.default;
		WelkinCheckin = welkinCheckin.default;
	};

	const importHelper = async () => {
		({ setBannerVersionAndPhase } = await import('$lib/helpers/importLocalData'));
	};

	let isMount = false;
	let isAnimatedBG = false;
	let bgVideo;
	$: audioActive = $backsound && $pageActive === 'index' && !$muted;
	$: if (audioActive) playSfx('wishBacksound');
	else if (isMount) playSfx('wishBacksound', { paused: true });

	const animateBG = () => {
		isAnimatedBG = checkLightweight() ? false : localConfig.get('animatedBG');
	};
	setContext('animateBG', animateBG);

	let showToast = false;
	const beginnerBanner = (beginnerConfig?.beginner || beginnerConfig)?.featured || {};
	let eventBanner;
	let weaponBanner;
	let standardBanner;
	let list = [];

	const showBeginnerCheck = (showBeginner) => {
		return;
	};

	const loaded = getContext('bannerLoaded');
	const updateBannerListToShow = (showBeginner) => {
		const config = getMerchConfig();
		list = (config.banners || []).filter((banner) => banner.active).map((banner) => {
			const poolItems = getMerchItems(banner.id);
			const featuredItems = poolItems.filter((item) => item.featured);
			const displayItems = [...(featuredItems.length ? featuredItems : poolItems)]
				.sort((a, b) => b.rarity - a.rarity)
				.slice(0, banner.display_limit || 3);
			const featuredItem = displayItems[0] || poolItems[0];
			return {
				type: banner.kind === 'weapon' ? 'weapons' : 'events',
				merch: true,
				character: {
					id: banner.id,
					name: banner.name,
					character: featuredItem?.name || '',
					featuredItem,
					merchItems: displayItems,
					title: banner.name,
					description: banner.description || config.settings.description,
					kind: banner.kind,
					theme: banner.theme || 'anemo'
				}
			};
		});
		bannerList.set(list);
		bannerActive.update((index) =>
			Math.min(Math.max(Number.isInteger(index) ? index : 0, 0), Math.max(list.length - 1, 0))
		);
		isFatepointSystem.set(false);
		isAcquaintUsed.set(false);
		pageActive.set('index');
		loaded();
		return;
	};

	const switchBanner = async (patch, bannerPhase) => {
		try {
			return updateBannerListToShow(false);
		} catch (e) {
			showToast = true;
			console.error(`Can't Switch banner because it unavailable !`, e);
		}
	};

	$: switchBanner($patchVersion, $bannerPhase);
	$: showBeginnerCheck($showBeginner);

	let showObtained = false;
	let obtainedItems = {};

	const handleObtained = (itemToBuy, value = 0) => {
		if (Array.isArray(itemToBuy)) {
			itemToBuy.forEach(({ item, value }) => {
				obtainedItems[item] = value;
			});
			showObtained = true;
			return;
		}
		obtainedItems[itemToBuy] = value;
		showObtained = true;
	};
	setContext('handleObtained', handleObtained);

	const handleCloseObtained = () => {
		showObtained = false;
		obtainedItems = {};
		playSfx('close');
		if ($pageActive === 'index') backsound.set(true);
	};

	let welkinCheckin = false;

	// Welkin
	const closeWelkin = () => (welkinCheckin = false);
	setContext('closeWelkin', closeWelkin);

	// Animated Background
	let hideBG = false;
	const bgToggle = (val) => {
		hideBG = val;
	};
	setContext('bgToggle', bgToggle);

	$: if (bgVideo) {
		if ($pageActive === 'index' && !hideBG && isAnimatedBG) {
			bgVideo.play().catch(() => {});
		} else {
			bgVideo.pause();
		}
	}
	const handleBlur = () => playSfx('wishBacksound', { paused: isMount });
	const handleFocus = () => {
		if (audioActive) playSfx('wishBacksound');
	};
	const handlePopState = (event) => {
		if (event.state?.page) return;
		if ($pageActive === 'index') return;
		pageActive.set('index');
	};

	onMount(async () => {
		await importHelper();
		animateBG();
		importChunks();
		isMount = true;
		setBannerVersionAndPhase();
		window.addEventListener('blur', handleBlur);
		window.addEventListener('focus', handleFocus);
		window.addEventListener('popstate', handlePopState);

		// Setup main page
		bannerActive.set(0);

		const { remaining, diff, latestCheckIn } = localWelkin.getData();
		welkinCheckin = remaining > 0 && remaining - diff >= 0 && diff > 0;
		if (latestCheckIn) localWelkin.checkin();
		if (!welkinCheckin) backsound.set(true);
	});

	onDestroy(() => {
		window.removeEventListener('blur', handleBlur);
		window.removeEventListener('focus', handleFocus);
		window.removeEventListener('popstate', handlePopState);
		bgVideo?.pause();
	});
</script>

{#if showToast}
	<Toast autoclose on:close={() => (showToast = false)}>
		{@html $t('wish.loadFailed')}
	</Toast>
{/if}

{#if showObtained && Obtained}
	<svelte:component this={Obtained} items={obtainedItems} on:close={handleCloseObtained} />
{/if}

{#if WelkinCheckin}
	<svelte:component this={WelkinCheckin} show={welkinCheckin} />
{/if}

{#if isAnimatedBG}
	<video
		bind:this={bgVideo}
		transition:fade|local={{ duration: 2000 }}
		muted
		loop
		autoplay
		playsinline
		poster={$assets['wish-background.webp']}
		class:hide={$pageActive !== 'index' || hideBG}
	>
		<source src="/videos/bg.webm" type="video/webm" />
		<track kind="captions" />
	</video>
{/if}

{#if $pageActive === 'index'}
	<MainWish />
{/if}

{#if $pageActive === 'shop' && MainShop}
	<svelte:component this={MainShop} />
{/if}

{#if $pageActive === 'inventory' && MainInventory}
	<svelte:component this={MainInventory} />
{/if}

{#if $pageActive === 'history' && GachaInfo}
	<svelte:component this={GachaInfo} page="history" />
{/if}

{#if $pageActive === 'details' && GachaInfo}
	<svelte:component this={GachaInfo} page="details" />
{/if}

<style>
	video {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 20%;
	}

	.hide {
		visibility: hidden;
	}
</style>
