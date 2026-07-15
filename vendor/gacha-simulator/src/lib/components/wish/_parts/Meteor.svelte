<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { t } from 'svelte-i18n';
	import {
		primogem,
		isAcquaintUsed,
		acquaint,
		intertwined,
		bannerList,
		bannerActive,
		muted,
		viewportHeight,
		assets,
		animeoff
	} from '$lib/store/stores';
	import { localBalance } from '$lib/store/localstore';
	import Modal from '$lib/components/utility/ModalTpl.svelte';
	import Toast from '$lib/components/utility/Toast.svelte';

	export let showMeteor = false;
	export let meteorStar = 3;
	export let singleMeteor = true;
	export let showConvertModal = false;
	export let rollCount = 0;

	let v3star;
	let v4starSingle;
	let v4star;
	let v5starSingle;
	let v5star;
	let showToast = false;

	let v3starSplash;
	let v3starSplash2;
	let v4starSplash;
	let v4starSplash2;
	let v5starSplash;
	let v5starSplash2;

	let preload3 = 'none';
	let preload4 = 'none';
	let preload5 = 'none';

	const dispatch = createEventDispatcher();
	$: balance = $isAcquaintUsed ? $acquaint : $intertwined;
	$: isBeginner = $bannerList[$bannerActive]?.type === 'beginner';
	$: balanceNeededToRoll = (isBeginner && rollCount > 1 ? 8 : rollCount) - balance;
	$: modalButton = $primogem < balanceNeededToRoll * 160 ? 'cancel' : 'all';
	$: fateType = $isAcquaintUsed ? 'acquaint' : 'intertwined';

	const closeExchangeModal = () => {
		dispatch('cancelModal');
	};

	const handleExchangeModal = async () => {
		const promise = new Promise((resolve, reject) => {
			if ($primogem < balanceNeededToRoll * 160) return reject('not enough primogem');
			primogem.update((n) => {
				const q = n - balanceNeededToRoll * 160;
				localBalance.set('primogem', q);
				return q;
			});

			if ($isAcquaintUsed) {
				acquaint.update((n) => {
					const q = n + balanceNeededToRoll;
					localBalance.set('acquaint', q);
					resolve('ok');
					return q;
				});
				return;
			}

			intertwined.update((n) => {
				const q = n + balanceNeededToRoll;
				localBalance.set('intertwined', q);
				resolve('ok');
				return q;
			});
		});
		await promise;
		dispatch('confirmModal');
	};

	const skip = () => {
		[v3star, v4starSingle, v4star, v5starSingle, v5star].forEach((video) => {
			video.load();
			video.style.display = 'none';
		});
		dispatch('skiped');
	};

	const showVideoHandle = (rarity, single = true) => {
		let videoContent = v3star;
		if (single && rarity !== 3) {
			videoContent = rarity === 5 ? v5starSingle : v4starSingle;
		}
		if (!single) {
			videoContent = rarity === 5 ? v5star : v4star;
		}

		if (videoContent.error) {
			showToast = true;
			console.error("Can't play Meteor Animation because it failed to load", videoContent.error);
			return dispatch('endAnimation');
		}

		videoContent.style.display = 'unset';
		let resolved = false;

		const timeoutId = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				videoContent.style.display = 'none';
				console.warn("Video play timed out (buffering took too long). Skipping animation.");
				dispatch('endAnimation');
			}
		}, 4000);

		videoContent.play()
			.then(() => {
				resolved = true;
				clearTimeout(timeoutId);
			})
			.catch((err) => {
				if (!resolved) {
					resolved = true;
					clearTimeout(timeoutId);
					videoContent.style.display = 'none';
					showToast = true;
					console.error("Failed to play video:", err);
					dispatch('endAnimation');
				}
			});
	};

	onMount(() => {
		// Set ended event listeners
		[v3star, v4starSingle, v4star, v5starSingle, v5star].forEach((video) => {
			video.addEventListener('ended', () => {
				video.style.display = 'none';
				video.load();
				dispatch('endAnimation');
			});
		});

		// Helper to fetch entire file at network level to cache it cleanly in SW (status 200)
		// before range requests slice it.
		const preloadVideoFile = (url) => {
			if (!url) return Promise.resolve();
			return fetch(url).catch((err) => console.warn('Preload failed for', url, err));
		};

		// Progressive preloading queue to avoid bottlenecking low-speed networks
		const preloadSequentially = async () => {
			// Step 1: Preload Tier 1 (3-star animations, ~94% probability)
			preload3 = 'auto';
			const tier1 = [
				preloadVideoFile($assets['3star-single.mp4']),
				preloadVideoFile($assets['3star-splashout.webm']),
				preloadVideoFile($assets['3star-splashout2.webm'])
			];
			// Wait for Tier 1 to be fully downloaded/cached, or max 3s fallback
			await Promise.race([
				Promise.all(tier1),
				new Promise((resolve) => setTimeout(resolve, 3000))
			]);

			if (v3star) v3star.load();
			if (v3starSplash) v3starSplash.load();
			if (v3starSplash2) v3starSplash2.load();

			// Step 2: Preload Tier 2 (4-star animations)
			preload4 = 'auto';
			const tier2 = [
				preloadVideoFile($assets['4star-single.mp4']),
				preloadVideoFile($assets['4star.mp4']),
				preloadVideoFile($assets['4star-splashout.webm']),
				preloadVideoFile($assets['4star-splashout2.webm'])
			];
			// Wait for Tier 2 to be cached, or max 4s fallback
			await Promise.race([
				Promise.all(tier2),
				new Promise((resolve) => setTimeout(resolve, 4000))
			]);

			if (v4starSingle) v4starSingle.load();
			if (v4star) v4star.load();
			if (v4starSplash) v4starSplash.load();
			if (v4starSplash2) v4starSplash2.load();

			// Step 3: Preload Tier 3 (5-star animations)
			preload5 = 'auto';
			const tier3 = [
				preloadVideoFile($assets['5star-single.mp4']),
				preloadVideoFile($assets['5star.mp4']),
				preloadVideoFile($assets['5star-splashout.webm']),
				preloadVideoFile($assets['5star-splashout2.webm'])
			];
			// Wait for Tier 3 to be cached, or max 4s fallback
			await Promise.race([
				Promise.all(tier3),
				new Promise((resolve) => setTimeout(resolve, 4000))
			]);

			if (v5starSingle) v5starSingle.load();
			if (v5star) v5star.load();
			if (v5starSplash) v5starSplash.load();
			if (v5starSplash2) v5starSplash2.load();
		};

		// Delay the start of background downloading by 200ms to allow smooth first paint
		setTimeout(preloadSequentially, 200);
	});

	$: if (showMeteor) {
		if (!$animeoff) showVideoHandle(meteorStar, singleMeteor);
		else dispatch('skiped');
	}
</script>

<Modal
	title={$t('shop.paimonBargains')}
	sfx={false}
	button={modalButton}
	show={showConvertModal}
	on:cancel={closeExchangeModal}
	on:confirm={handleExchangeModal}
>
	<div class="exchange">
		<div>
			{@html $t('shop.fateNeeded', {
				values: {
					rollQty: `<span class="yellow">${balanceNeededToRoll}</span>`,
					currency: $t(`shop.item.${fateType}`)
				}
			})}
			<br />

			{@html $t('shop.primoNeeded', {
				values: {
					primoPrice: `<span class="${$primogem < balanceNeededToRoll * 160 ? 'red' : 'yellow'}"> ${
						balanceNeededToRoll * 160
					} </span>`
				}
			})}

			{#if $primogem < balanceNeededToRoll * 160}
				<br />
				<br />
				<span class="red">{$t('shop.insufficient')}</span>
			{/if}
		</div>
	</div>
</Modal>

{#if showToast}
	<Toast on:close={() => (showToast = false)}>{$t('wish.result.meteorFailed')}</Toast>
{/if}

<div class="wish-output" class:show={showMeteor} style="height: {$viewportHeight}px">
	<div class="video">
		<video bind:this={v3star} preload={preload3} muted={$muted} src={$assets['3star-single.mp4']} type="video/mp4" />
		<video
			bind:this={v4starSingle}
			preload={preload4}
			muted={$muted}
			src={$assets['4star-single.mp4']}
			type="video/mp4"
		/>
		<video bind:this={v4star} preload={preload4} muted={$muted} src={$assets['4star.mp4']} type="video/mp4" />
		<video
			bind:this={v5starSingle}
			preload={preload5}
			muted={$muted}
			src={$assets['5star-single.mp4']}
			type="video/mp4"
		/>
		<video bind:this={v5star} preload={preload5} muted={$muted} src={$assets['5star.mp4']} type="video/mp4" />

		<button class="skip" on:click={skip}>{$t('wish.result.skip')} <i class="gi-caret-up" /></button>
	</div>
</div>

<!-- Hidden dummy elements to trigger progressive background loading/caching of WebM splash animations -->
<video bind:this={v3starSplash} preload={preload3} muted src={$assets['3star-splashout.webm']} type="video/webm" style="display: none;" />
<video bind:this={v3starSplash2} preload={preload3} muted src={$assets['3star-splashout2.webm']} type="video/webm" style="display: none;" />
<video bind:this={v4starSplash} preload={preload4} muted src={$assets['4star-splashout.webm']} type="video/webm" style="display: none;" />
<video bind:this={v4starSplash2} preload={preload4} muted src={$assets['4star-splashout2.webm']} type="video/webm" style="display: none;" />
<video bind:this={v5starSplash} preload={preload5} muted src={$assets['5star-splashout.webm']} type="video/webm" style="display: none;" />
<video bind:this={v5starSplash2} preload={preload5} muted src={$assets['5star-splashout2.webm']} type="video/webm" style="display: none;" />

<style>
	.exchange :global(.red) {
		color: #de2f22 !important;
	}
	.exchange :global(.yellow) {
		color: rgb(218, 177, 45) !important;
	}
	.exchange {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.wish-output {
		position: fixed;
		z-index: 998;
		display: none;
		top: 0;
		left: 0;
		width: 100vw;
	}
	.wish-output.show {
		display: block;
		background-color: #fff;
	}
	.video {
		position: relative;
		width: 100vw;
		height: 100%;
	}

	.skip {
		position: absolute;
		top: 2%;
		right: 2%;
		color: #fff;
		font-size: 1.2rem;
		z-index: 10;
	}

	.gi-caret-up {
		display: inline-block;
		transform: rotate(90deg) translateX(-0.1rem);
		vertical-align: middle;
		margin-left: -0.5em;
	}

	:global(.mobile) .skip {
		font-size: 0.8rem;
		right: 6%;
		top: 1rem;
	}
	video {
		display: none;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 105%;
		height: 105%;
		object-fit: cover;
	}
</style>
