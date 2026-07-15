<script>
	import {
		bannerActive,
		viewportHeight,
		viewportWidth,
		bannerList,
		mobileMode
	} from '$lib/store/stores';
	import { playSfx } from '$lib/helpers/audio/audio.svelte';
	import BannerCard from './_banner-card.svelte';

	$: landscape = $viewportWidth / 2.1 > $viewportHeight;
	$: tabletBannerStyle = landscape ? 'width: 90vh' : '';
	$: mobileBannerStyle = $mobileMode
		? `max-width: ${(150 / 100) * $viewportHeight}px;`
		: tabletBannerStyle;
	$: style =
		$viewportHeight > 800 ||
		$viewportHeight > $viewportWidth ||
		$viewportHeight / $viewportWidth > 0.5
			? 'align-items:center;'
			: '';

	const navigate = (target) => {
		playSfx('changebanner');
		if (target === 'next') {
			return bannerActive.update((n) => n + 1);
		}
		if (target === 'previous') {
			return bannerActive.update((n) => n - 1);
		}
	};
</script>

<div class="banner-container" {style}>
	{#each $bannerList as data, i}
		<div
			class="banner-item"
			class:is-active={$bannerActive === i}
			aria-hidden={$bannerActive !== i}
			inert={$bannerActive !== i}
			style={mobileBannerStyle}
		>
			<BannerCard {data} index={i} />
		</div>
	{/each}

	<div class="navigate">
		{#if $bannerActive > 0}
			<button
				class="left"
				style="margin-right: auto;"
				on:click={() => navigate('previous')}
			>
				<i class="gi-arrow-left" />
			</button>
		{/if}

		{#if $bannerActive < $bannerList.length - 1}
			<button
				class="left"
				style="margin-left: auto;"
				on:click={() => navigate('next')}
			>
				<i class="gi-arrow-right" />
			</button>
		{/if}
	</div>
</div>

<style>
	.banner-container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	:global(.mobile) .banner-container {
		align-items: flex-end;
		padding: 0;
	}

	.banner-item {
		position: absolute;
		max-width: 900px;
		width: 80%;
		max-height: 100%;
		aspect-ratio: 27/14;
		opacity: 0;
		pointer-events: none;
		transform: translate3d(12px, 0, 0) scale(0.995);
		transition: opacity 140ms ease-out, transform 180ms ease-out;
	}
	.banner-item.is-active {
		z-index: 1;
		opacity: 1;
		pointer-events: auto;
		transform: translate3d(0, 0, 0) scale(1);
		will-change: transform, opacity;
	}

	@media (prefers-reduced-motion: reduce) {
		.banner-item {
			transition: none;
			transform: none;
			will-change: auto;
		}
	}

	.navigate {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 85%;
		transform: translate(-50%, -50%);
		display: flex;
		justify-content: space-between;
		transition: all 0.2s;
	}

	@media screen and (max-width: 1200px) {
		.navigate {
			width: 90%;
		}
	}

	@media screen and (max-width: 800px) {
		.navigate {
			width: 95%;
		}
	}

	.navigate button {
		color: #ece5d8;
		font-size: 2rem;
		line-height: 0;
	}

	:global(.mobile) .navigate {
		display: none;
	}
</style>
