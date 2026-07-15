<script>
	// Packagae
	import { isLoading, locale } from 'svelte-i18n';
	import { dev } from '$app/environment';
	import { onDestroy, onMount, setContext } from 'svelte';
	import {
		viewportHeight,
		viewportWidth,
		isMobile,
		mobileMode,
		isAcquaintUsed,
		bannerActive,
		bannerList,
		assets,
		isPWA
	} from '$lib/store/stores';
	import { mountLocale } from '$lib/helpers/i18n';
	import { importLocalBalance } from '$lib/helpers/importLocalData';
	import { mobileDetect } from '$lib/helpers/mobileDetect';
	import { userCurrencies } from '$lib/helpers/currencies';
	import { wakeLock } from '$lib/helpers/wakeLock';
	import { IDBUpdater } from '$lib/helpers/IDBUpdater';
	import '../app.css';
	import 'overlayscrollbars/css/OverlayScrollbars.css';
	import Loader from '$lib/components/utility/Loader.svelte';

	let innerHeight;
	let innerWidth;
	let isBannerLoaded = false;
	let isloaded = false;
	let showAd = false;

	$: lc = $locale?.toLowerCase() || '';
	$: isYuanshen = lc.includes('cn') || lc.includes('ja');
	$: font = isYuanshen || lc.includes('th') ? lc.split('-')[0] : 'global';

	$: viewportWidth.set(innerWidth);
	$: viewportHeight.set(innerHeight);
	$: directLoad = false;
	$: preview = false;

	$: if ($bannerList.length > 0) {
		const { type } = $bannerList[$bannerActive];
		isAcquaintUsed.set(type === 'standard' || type === 'beginner');
	}

	const setMobileMode = () => {
		if ($isPWA) return mobileMode.set(true);
		mobileMode.set(window.innerWidth > window.innerHeight);
	};

	setContext('bannerLoaded', () => (isBannerLoaded = true));
	setContext('loaded', () => (isloaded = true));
	setContext('showAd', (show) => (showAd = show));

	mountLocale();
	onMount(() => {
		const url = new URL(window.location.href);
		const searchParams = new URLSearchParams(url.search);
		isPWA.set(searchParams.get('pwa') === 'true' || !!searchParams.get('pwasc'));

		wakeLock();

		IDBUpdater();
		importLocalBalance();
		userCurrencies.init();

		isMobile.set(mobileDetect() || innerWidth < 601);
		if ($isMobile) setMobileMode();

		window.addEventListener('orientationchange', () => {
			if ($isMobile) setMobileMode();
		});
		window.addEventListener('resize', setMobileMode);

		// prevent Righ click (hold on android) on production mode
		if (!dev) document.addEventListener('contextmenu', (e) => e.preventDefault());
	});

	onDestroy(() => window.removeEventListener('resize', setMobileMode));
</script>

<svelte:window bind:innerHeight bind:innerWidth />

<svelte:head>
	<title>Matsuri Wish Simulator</title>
	<meta name="description" content="A free merch wish minigame." />

	<link
		rel="preload"
		href="/fonts/optimized_global_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_th_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_jp_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_zh_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>

</svelte:head>

<Loader {isBannerLoaded} {directLoad} />

<main
	class:mobile={$mobileMode}
	class:preview
	class={$locale}
	style="height: {$viewportHeight ? `${$viewportHeight}px` : '100vh'};
		--genshin-font: var(--gi-{font}-font)"
>
	{#if !$isLoading && isloaded}
		<slot />
	{/if}

</main>

<style global>
	@font-face {
		font-family: 'GI_Global_Web';
		src: url('/fonts/optimized_global_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'GI_JA_Web';
		src: url('/fonts/optimized_jp_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'GI_TH_Web';
		src: url('/fonts/optimized_th_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'GI_ZH_Web';
		src: url('/fonts/optimized_zh_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	:global(.os-theme-light > .os-scrollbar > .os-scrollbar-track > .os-scrollbar-handle) {
		background-color: #d2c69c;
		opacity: 0.5;
	}
	:global(.os-theme-light > .os-scrollbar > .os-scrollbar-track > .os-scrollbar-handle:hover),
	:global(.os-theme-light > .os-scrollbar > .os-scrollbar-track > .os-scrollbar-handle:active) {
		background-color: #d2c69c;
		opacity: 1;
	}

	:global(.os-theme-light > .os-scrollbar-vertical) {
		width: 8px;
	}
	:global(.os-theme-light > .os-scrollbar-horizontal) {
		height: 8px;
	}

	main {
		display: block;
		width: 100%;
		overflow: hidden;
		font-family: var(--genshin-font);
	}

	:global(audio) {
		visibility: hidden;
	}

	.logo {
		display: none;
	}
	.preview .logo {
		display: block;
		width: 30vh;
		max-width: 30%;
		position: fixed;
		bottom: 0px;
		right: 2em;
	}

	.preview .logo.yuanshen {
		max-height: 20vh;
		width: 20vh;
	}
</style>
