<script>
	import { getContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { check, loadAnimation, loadProggress } from '$lib/helpers/express-loader';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { assets, autoskip } from '$lib/stores/app-store';
	import { localConfig } from '$lib/helpers/dataAPI/api-localstorage';
	import ButtonGeneral from '$lib/components/ButtonGeneral.svelte';

	let animationLoading = false;
	let animationReady = false;
	let expressLoadRequested = false;
	let offlineStatus = 'idle';
	let offlineProgress = 0;
	let item = '';
	let progress = 0;
	let totalItem;
	let itemIndex;
	let loadError = '';
	$: ({ item, progress, itemIndex, totalItem } = $loadProggress);
	$: animationPercentage = ((itemIndex * 100 + progress) / (totalItem * 100)) * 100;
	$: onProgress = animationLoading || offlineStatus === 'downloading';
	$: percentage = animationLoading ? animationPercentage : offlineProgress;
	$: warpType = item.includes('regular') ? 'Regular Warp' : 'Special Warp';

	const readyToPull = getContext('readyToPull');
	$: ready = $readyToPull;

	onMount(() => {
		const handleOfflineProgress = (event) => {
			if (
				event.origin !== window.location.origin ||
				event.data?.type !== 'matsuri-gacha-offline-progress'
			)
				return;
			offlineStatus = event.data.status;
			offlineProgress = Number(event.data.progress) || 0;
			if (offlineStatus === 'ready') {
				if (animationReady) readyToPull.set(true);
				else if (expressLoadRequested && !animationLoading) void loadExpressAnimation();
			}
			if (offlineStatus === 'error') {
				loadError =
					event.data?.message ||
					'The offline files could not be saved. Check your connection and try again.';
			}
		};
		window.addEventListener('message', handleOfflineProgress);
		window.parent.postMessage(
			{ type: 'matsuri-gacha-offline-status' },
			window.location.origin
		);

		void (async () => {
		const lskipConfig = localConfig.get('autoskip') || {};
		const { express: skipExpress = false } = lskipConfig === true ? { express: true } : lskipConfig;
		const hasStreamableAnimation = Boolean($assets['event-3star.mp4']);
		animationReady = hasStreamableAnimation || (await check());
		if (skipExpress) readyToPull.set(true);
		else if (animationReady && offlineStatus === 'ready') readyToPull.set(true);
		})();

		return () => window.removeEventListener('message', handleOfflineProgress);
	});

	const skipExpress = () => {
		playSfx();
		autoskip.set({ express: true, art: true });
		readyToPull.set(true);
		localConfig.set('autoskip', { express: true, art: true });
	};

	const loadExpressAnimation = async () => {
		animationLoading = true;
		try {
			const data = await loadAnimation();
			assets.update((v) => {
				data.forEach(({ asset, url }) => {
					if (v[asset]?.startsWith('blob:')) URL.revokeObjectURL(v[asset]);
					v[asset] = url;
				});
				return v;
			});
			animationReady = true;
			if (offlineStatus === 'ready') readyToPull.set(true);
		} catch (error) {
			console.error('Unable to preload the HSR warp animation.', error);
			loadError = 'The warp animation could not be downloaded. Try again or skip it.';
		} finally {
			animationLoading = false;
		}
	};

	const preloadExpress = () => {
		playSfx();
		expressLoadRequested = true;
		loadError = '';
		if (offlineStatus === 'ready') {
			void loadExpressAnimation();
			return;
		}
		offlineStatus = 'downloading';
		offlineProgress = 0;
		window.parent.postMessage(
			{ type: 'matsuri-gacha-offline-request' },
			window.location.origin
		);
	};
</script>

{#if !ready}
	<div class="tooltip" transition:fade={{ duration: 250 }}>
		{#if onProgress}
			<div class="loader">
				<div class="load-text" style="position: relative;">
					{#if animationLoading}
						{@html $t('warp.loadExpressMsg', { values: { item: `<span> ${warpType} </span>` } })}
					{:else}
						{$t('warp.offlinePackMsg')}
					{/if}
				</div>
				<div class="progress-bar" style="--per:{percentage}%">
					<span></span>
				</div>
				<div class="percentage">
					{percentage.toFixed(0)}%
				</div>
			</div>
		{:else}
			<div class="prompt-text">
				{#if loadError}<strong class="load-error">{loadError}</strong>{/if}
				{@html $t('warp.expressNotLoaded')}
				<small>
					{$t('warp.preloadFilesMsg')}
					<br />{$t('warp.offlinePackMsg')}
				</small>
			</div>
			<div class="options">
				<ButtonGeneral icon="refresh" on:click={preloadExpress}>
					{$t('warp.loadExpress')}
				</ButtonGeneral>
				<ButtonGeneral icon="skip" on:click={skipExpress}>
					{$t('warp.skipExpress')}
				</ButtonGeneral>
			</div>
		{/if}
	</div>
{/if}

<style>
	.tooltip {
		min-width: 300px;
		width: 30%;
		position: fixed;
		bottom: 15%;
		right: 5%;
		z-index: +100;
		background-color: rgba(16, 20, 25, 0.94);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.22);
		padding: 2% 2% 1.5%;
		border-radius: 0.5rem;
		box-shadow: 0 0 1rem rgba(255, 255, 255, 1);
	}
	.prompt-text {
		font-size: 120%;
	}
	.load-error {
		display: block;
		margin-bottom: 0.5rem;
		color: #ffd2c7;
	}

	.prompt-text :global(span),
	.loader :global(span) {
		color: var(--color-second);
		position: relative;
	}

	small {
		display: block;
		padding: 2%;
		opacity: 0.8;
	}

	.loader {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.load-text::after {
		content: '.';
		position: absolute;
		right: 0;
		transform: translateX(100%);
		bottom: 0;
		animation: dot 3s infinite;
	}

	.progress-bar {
		width: 100%;
		height: 0.2rem;
		background-color: #ccc;
		margin: 3% 0;
		position: relative;
		border-radius: 1rem;
	}

	.progress-bar span {
		border-radius: inherit;
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		width: var(--per);
		height: 120%;
		background-image: linear-gradient(to left, #efd26c, #c59a62);
		box-shadow: 0 0 0.1rem #fff;
		transition: width 0.05s;
	}

	.options {
		padding: 2% 1% 0;
		text-align: center;
	}
	.tooltip :global(button) {
		font-size: 80%;
		margin: 1%;
		padding: 2% 5%;
	}

	@keyframes dot {
		0% {
			content: '.';
		}
		25% {
			content: '..';
		}
		50% {
			content: '...';
		}
		100% {
			content: '';
		}
	}
</style>
