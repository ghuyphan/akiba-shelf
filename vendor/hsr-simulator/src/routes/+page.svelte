<script>
	import { onDestroy, onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import {
		activePhase,
		activeVersion,
		isMobile,
		liteMode,
		showStarterBanner
	} from '$lib/stores/app-store';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { initTrack, pauseTrack, resumeTrack } from '$lib/helpers/sounds/phonograph';
	import { importLocalConfig, setBannerVersionAndPhase } from '$lib/helpers/dataAPI/storage-reader';
	import { browserState } from '$lib/helpers/page-navigation';
	import { handleShowStarter, initializeBanner } from '$lib/helpers/banner-loader';
	import { userCurrencies } from '$lib/helpers/shop-price';
	import { localConfig } from '$lib/helpers/dataAPI/api-localstorage';

	import PreloadExpress from './_index/PreloadExpress.svelte';
	import Banners from './_warp/index.svelte';
	import Menu from './_menu/index.svelte';

	let Collection, Shop, GachaInfo, Phonograph, ObtainedItem, ModalConvert;
	const asyncLoadComponent = async () => {
		ObtainedItem = (await import('$lib/components/ObtainedItem.svelte')).default;
		ModalConvert = (await import('$lib/components/ModalConvert.svelte')).default;

		Collection = (await import('./_collection/index.svelte')).default;
		Shop = (await import('./_shop/index.svelte')).default;
		GachaInfo = (await import('./_gachainfo/index.svelte')).default;
		Phonograph = (await import('./_phonograph/index.svelte')).default;
	};

	let status;
	let pageActive = 'index';
	const navigate = (page) => {
		let beforeNavigate = pageActive;
		pageActive = page;
		if (beforeNavigate !== 'index') return browserState.back();
		if (beforeNavigate === pageActive) return;
		browserState.set(page);
	};
	setContext('navigate', navigate);

	const checkBannerStatus = async (initBanner) => ({ status } = await initBanner);
	$: initBanner = initializeBanner($activeVersion, $activePhase);
	$: checkBannerStatus(initBanner);
	$: handleShowStarter($showStarterBanner);

	const handleLiteMode = () => {
		const lLitemode = localConfig.get('litemode');
		if (typeof lLitemode !== 'boolean') {
			liteMode.set(true);
			localConfig.set('litemode', true);
		}
	};

	const onWarp = writable(false);
	setContext('onWarp', onWarp);

	const handleTrack = () => {
		if ($onWarp) return;

		const mode = document.visibilityState;
		if (mode === 'visible') return resumeTrack();
		pauseTrack({ stop: false });
	};
	const handlePopState = (event) => {
		if (event.state?.page) return;
		if (pageActive === 'index') return;
		navigate('index');
	};

	onMount(() => {
		setBannerVersionAndPhase();
		importLocalConfig();

		// Load Component
		asyncLoadComponent();

		// litemode
		if ($isMobile) handleLiteMode();

		// Detect Currencies
		userCurrencies.init();

		// Play track
		initTrack();
		handleTrack();

		window.addEventListener('popstate', handlePopState);
		document.addEventListener('visibilitychange', handleTrack);
	});

	onDestroy(() => {
		window.removeEventListener('popstate', handlePopState);
		document.removeEventListener('visibilitychange', handleTrack);
		pauseTrack({ stop: true });
	});

	// Convert Modal
	let showConvertModal = false;
	setContext('openConvertModal', () => (showConvertModal = true));
	setContext('closeConvertModal', () => (showConvertModal = false));

	// Obtained
	let showObtained = false;
	let obtainedData = {};
	const openObtained = (data) => {
		obtainedData = data;
		showObtained = true;
	};
	const closeObtained = () => {
		showObtained = false;
		obtainedData = {};
		playSfx('modal-close');
	};
	setContext('openObtained', openObtained);
	setContext('closeObtained', closeObtained);

	// Express Loader
	// Keep the preload/offline prompt visible until PreloadExpress verifies
	// either auto-skip or a genuinely available local animation/offline pack.
	const readyToPull = writable(false);
	setContext('readyToPull', readyToPull);
</script>

{#if status === 'error'}
	error bos
{/if}

<!-- Warp Section -->
{#if pageActive === 'index'}
	<Banners />
	<Menu />



	<!-- Inventory -->
{:else if pageActive === 'collection'}
	<svelte:component this={Collection} />

	<!-- Shop -->
{:else if pageActive === 'shop'}
	<svelte:component this={Shop} />

	<!-- Wrap Details -->
{:else if pageActive === 'details'}
	<svelte:component this={GachaInfo} />

	<!-- Phonograph -->
{:else if pageActive === 'phonograph'}
	<svelte:component this={Phonograph} />
{/if}

{#if showObtained}
	<svelte:component this={ObtainedItem} {...obtainedData} />
{/if}

{#if showConvertModal}
	<svelte:component this={ModalConvert} />
{/if}

<PreloadExpress />
