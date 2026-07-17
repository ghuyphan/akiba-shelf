<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount, setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { writable } from 'svelte/store';
	import { isLoading, locale } from 'svelte-i18n';
	import { dev, browser } from '$app/environment';
	import { base } from '$app/paths';
	import './styles.css';

	import {
		isMobile,
		isMobileLandscape,
		isPWA,
		viewportWidth,
		viewportHeight
	} from '$lib/stores/app-store';
	import { APP_TITLE, DESCRIPTION, HOST, KEYWORDS } from '$lib/data/site-setup.json';
	import { IDBUpdater } from '$lib/helpers/migrator/idbUpdater';
	import { disposeWakeLock, wakeLock } from '$lib/helpers/wakelock';
	import { mobileDetect } from '$lib/helpers/mobile-detect';
	import { loadTracks } from '$lib/helpers/sounds/media-session';
	import { mountLocale } from '$lib/helpers/i18n';

	import InitialLoader from './_index/InitialLoader.svelte';

	let isLoaded = false;
	const showAd = writable(false);
	setContext('loaded', () => (isLoaded = true));
	setContext('showAd', showAd);

	let innerHeight;
	let innerWidth;
	$: viewportWidth.set(innerWidth);
	$: viewportHeight.set(innerHeight);
	$: previewScreen = $page.url.pathname.includes('screen');

	let font = '';
	$: {
		const lc = $locale?.toLowerCase() || '';
		const cnLogo = lc.match(/(zh|ja)/);
		font = cnLogo || lc.includes('th') ? lc.split('-')[0] : 'os';
	}

	const redirectIfNotValidPath = () => {
		const allowedPath = ['screen', 'feedback', 'privacy-policy'];
		let { pathname } = $page.url;
		if (pathname.startsWith('/hsr-simulator')) {
			pathname = pathname.slice('/hsr-simulator'.length);
		}
		const pathNow = pathname.split('/')[1];
		if (!pathNow || allowedPath.includes(pathNow)) return;
		return goto('/');
	};

	const setMobileMode = () => {
		if ($isPWA) return isMobileLandscape.set(true);
		const angle = screen.orientation?.angle || 0;
		const rotate = angle === 90 || angle === 270;
		isMobileLandscape.set(rotate);
	};
	const handleOrientationChange = () => {
		if ($isMobile) setMobileMode();
	};
	const preventContextMenu = (event) => event.preventDefault();

	mountLocale();
	onMount(async () => {
		redirectIfNotValidPath();

		const url = new URL(window.location.href);
		const searchParams = new URLSearchParams(url.search);
		isPWA.set(!!searchParams.get('pwasc'));

		isMobile.set(mobileDetect() || innerWidth < 601);
		if ($isMobile) setMobileMode();

		window.addEventListener('orientationchange', handleOrientationChange);

		loadTracks(); // Load Phonograph Tracks
		wakeLock(); // Prevent screen off while open the app
		await IDBUpdater(); // update site data to the newer version

		// Service Worker for Faster Load
		// if ('serviceWorker' in navigator && !dev) {
		// 	navigator.serviceWorker.register('/sw.js'); // /dev-sw.js?dev-sw
		// }
		// prevent Righ click (hold on android) on production mode
		if (!dev) document.addEventListener('contextmenu', preventContextMenu);
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('orientationchange', handleOrientationChange);
			document.removeEventListener('contextmenu', preventContextMenu);
			disposeWakeLock();
		}
	});
</script>

<svelte:window bind:innerHeight bind:innerWidth />

<svelte:head>
	<meta name="description" content={DESCRIPTION} />
	<meta name="keywords" content={KEYWORDS} />
	<meta property="al:web:url" content={HOST} />
	<link rel="fluid-icon" href="{HOST}/meta-picture.jpg" title={APP_TITLE} />

	<meta property="og:url" content={HOST} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={APP_TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:image" content="{HOST}/meta-picture.jpg" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content={HOST.replace('https://', '').replace('http://', '')} />
	<meta property="twitter:url" content={HOST} />
	<meta name="twitter:title" content={APP_TITLE} />
	<meta name="twitter:description" content={DESCRIPTION} />
	<meta name="twitter:image" content="{HOST}/meta-picture.jpg" />



	{#if $page.url.pathname !== '/'}
		<link rel="canonical" href={HOST} />
	{/if}

	<link
		rel="preload"
		href="{base}/fonts/NovecentoSans-WideBold.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="{base}/fonts/StarRailNeue-Regular.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="{base}/fonts/optimized_global_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="{base}/fonts/optimized_ja_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="{base}/fonts/optimized_zh_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	{@html `<style>
		@font-face {
			font-family: 'StarRail_ZH_Web';
			src: url('${base}/fonts/optimized_zh_web.woff2') format('woff2');
			font-weight: normal;
			font-style: normal;
		}

		@font-face {
			font-family: 'StarRail Neue';
			src: url('${base}/fonts/StarRailNeue-Regular.woff2') format('woff2');
			font-weight: normal;
			font-style: normal;
		}

		@font-face {
			font-family: 'Novecento';
			src: url('${base}/fonts/NovecentoSans-WideBold.woff2') format('woff2');
			font-weight: normal;
			font-style: normal;
		}

		@font-face {
			font-family: 'StarRail_Global_Web';
			src: url('${base}/fonts/optimized_global_web.woff2') format('woff2');
			font-weight: normal;
			font-style: normal;
		}

		@font-face {
			font-family: 'StarRail_JA_Web';
			src: url('${base}/fonts/optimized_ja_web.woff2') format('woff2');
			font-weight: normal;
			font-style: normal;
		}

		@font-face {
			font-family: 'HSR Icon';
			src: url('${base}/fonts/hsr-icon.eot');
			src:
				url('${base}/fonts/hsr-icon.eot?#iefix') format('embedded-opentype'),
				url('${base}/fonts/hsr-icon.woff') format('woff'),
				url('${base}/fonts/hsr-icon.ttf') format('truetype'),
				url('${base}/fonts/hsr-icon.svg#hsr-icon') format('svg');
			font-weight: normal;
			font-style: normal;
		}
	</style>`}
</svelte:head>

<main
	style="--screen-width:{innerWidth}px; --screen-height:{innerHeight}px; --ratio:{innerWidth}/{innerHeight}; --hsr-font:var(--hsr-{font}-font)"
	class:mobileLandscape={$isMobileLandscape}
	class={$locale}
>
	{#if !isLoaded}
		<div class="loading" transition:fade={{ duration: 250 }}>
			<InitialLoader />
		</div>
	{/if}

	{#if !$isLoading && isLoaded}
		<slot />
	{/if}


</main>

<style>




	main {
		display: block;
		width: 100vw;
		height: 100vh;
		aspect-ratio: var(--ratio);
		overflow: hidden;
		font-family: var(--hsr-font);
		background-color: #000;
	}

	.loading {
		width: 100vw;
		height: 100%;
		position: absolute;
		z-index: 9980;
		left: 0;
		top: 0;
	}

	:global(audio) {
		visibility: hidden;
	}


</style>
