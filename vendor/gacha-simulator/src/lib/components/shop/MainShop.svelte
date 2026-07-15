<script>
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { APP_TITLE } from '$lib/env';
	import { mobileMode, viewportHeight, viewportWidth, assets } from '$lib/store/stores';
	import { playSfx } from '$lib/helpers/audio/audio.svelte';

	// Components
	import ShopHeader from './ShopHeader.svelte';
	import ShopNavbar from './ShopNavbar.svelte';
	import PaimonBargains from './PaimonBargains.svelte';
	import Recomended from './Recomended.svelte';
	import GenesisCrystal from './GenesisCrystal.svelte';

	const random = (min, max) => {
		min = Math.ceil(min);
		max = Math.floor(max);
		return Math.floor(Math.random() * (max - min + 1)) + min;
	};

	$: title = $t('title', { default: APP_TITLE });
	let activeShop = 'genesis';
	let showNavbar = true;
	let showNavbarButton = false;

	const selectShop = (e) => {
		const { selected } = e.detail;
		if (activeShop === selected) return;
		activeShop = selected;
		playSfx('shopnav');
		if ($viewportWidth < 500) showNavbar = false;
	};

	$: if (!$mobileMode) {
		if ($viewportWidth < 745) {
			showNavbar = false;
			showNavbarButton = true;
		} else {
			showNavbar = true;
			showNavbarButton = false;
		}
	} else {
		showNavbar = true;
		showNavbarButton = false;
	}

	const showNavbarHandle = ({ detail }) => {
		showNavbar = detail.showNavbar;
		playSfx();
	};

	let contentHeight;
</script>

<svelte:head>
	{#if activeShop === 'genesis'}
		<title>{$t('shop.buyGenesisHeading')} | {title}</title>
	{:else if activeShop === 'recomended'}
		<title>{$t('shop.recomendedHeading')} | {title}</title>
	{:else}
		<title>{$t('shop.paimonHeading')} | {title}</title>
	{/if}
</svelte:head>

<section style="height: {$viewportHeight}px">
	<img class="bg" src={$assets[`bg${random(1, 25)}.webp`]} alt="background" />
	<div class="container">
		<ShopNavbar
			show={showNavbar}
			on:select={selectShop}
			on:close={() => {
				showNavbar = false;
				playSfx();
			}}
		/>
		<div class="items-container">
			<ShopHeader {activeShop} {showNavbar} {showNavbarButton} on:showNavbar={showNavbarHandle} />

			<div
				class="item-body"
				in:fade={{ duration: 300 }}
				bind:clientHeight={contentHeight}
				style="--content-height:{contentHeight}px"
			>
				{#if activeShop === 'genesis'}
					<GenesisCrystal />

					<!-- Recomended Item -->
				{:else if activeShop === 'recomended'}
					<Recomended />
					<!-- PAIMON BARGAINS -->
				{:else if activeShop === 'paimon-bargains'}
					<PaimonBargains />
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	section {
		width: 100vw;
		display: block;
		position: relative;
		font-size: 1rem;
		/* background: linear-gradient(135deg, rgb(112, 31, 164), transparent 45%),
			linear-gradient(225deg, rgb(223, 220, 116), transparent 60%),
			linear-gradient(315deg, rgb(242, 79, 202), rgb(80, 148, 215) 25%, rgb(175, 28, 181));
		background-size: cover; */
		background-color: var(--text-color);
	}

	.item-body {
		height: 100%;
		overflow-y: auto;
	}

	:global(.mobile) section {
		font-size: 0.8rem;
	}
	.bg {
		width: 100vw;
		height: 100%;
		object-fit: cover;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(1.1);
		filter: blur(10px);
		-webkit-filter: blur(10px);
		z-index: +1;
	}

	section::after {
		position: absolute;
		content: '';
		display: block;
		top: 0;
		left: 0;
		height: 100%;
		width: 100%;
		background-color: rgba(0, 0, 0, 0.2);
		z-index: -1;
	}

	.container {
		display: flex;
		padding: 0 3% 0 0;
		position: relative;
		z-index: +2;
		width: 100%;
		height: 100%;
	}

	:global(.mobile) .container {
		padding: 0 2%;
	}

	@media screen and (max-width: 745px) {
		.container {
			padding: 0 3%;
		}
	}

	.items-container {
		width: 100%;
	}
</style>
