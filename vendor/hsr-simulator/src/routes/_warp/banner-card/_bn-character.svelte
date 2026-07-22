<script>
	import { t } from 'svelte-i18n';
	import { fade } from 'svelte/transition';
	import { bezier } from '$lib/helpers/easing';
	import { fly } from '$lib/helpers/transition';
	import { data } from '$lib/data/characters.json';
	import { assets, isMobileLandscape, liteMode, probEdit } from '$lib/stores/app-store';
	import positionToStyle from '$lib/helpers/css-transformer';
	import BannerTpl from './__banner-tpl.svelte';

	export let item = {};
	export let group = false;

	let hideOverflow = false;
	const characterOffset = (characterName, ismobile) => {
		const found = data.find(({ name }) => name === characterName);
		if (!found) return '';
		const { bannerOffset = {} } = found;
		hideOverflow = bannerOffset?.o == 'hide';
		if (!ismobile) return positionToStyle(bannerOffset);

		const tmp = {};
		tmp.b = (bannerOffset?.b || 0) + 87;
		tmp.l = (bannerOffset?.l || 0) + 3;

		return positionToStyle({ ...bannerOffset, ...tmp });
	};

	$: visualItem = item.featured || item.displayItem;
	$: offset = characterOffset(visualItem, $isMobileLandscape);
</script>

<BannerTpl {group}>
	<div class="content" class:group class:lite={$liteMode}>
		<div class="featured-bg"></div>
		<div class="overflow" class:hide={hideOverflow}>
			{#if !$probEdit}
				<div class="splash-art">
					<div class="wrapper" in:fade|global>
						<div class="mask-content">
							<div
								class="art-pic"
								in:fly|global={{
									x: -50,
									duration: 4000,
									delay: 250,
									opacity: 1,
									easing: bezier(0.13, 0.14, 0, 1)
								}}
							>
								<picture style={offset}>
									<source
										srcset={$assets[`splash-art/large/${visualItem}`]}
										media="(min-width: 1280px)"
									/>
									<source
										srcset={$assets[`splash-art/medium/${visualItem}`]}
										media="(min-width: 640px)"
									/>
									<img
										crossorigin="anonymous"
										alt={visualItem ? $t(visualItem) : ''}
										src={$assets[`splash-art/small/${visualItem}`]}
									/>
								</picture>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</BannerTpl>

<style>
	.content {
		width: 100%;
		height: 100%;
		position: relative;
	}

	.featured-bg {
		width: 100%;
		height: 100%;
		z-index: -1;
		/* Merch photography must remain an opaque card instead of fading into
		   the blurred full-screen backdrop. */
		mask-image: none;
		background-image: linear-gradient(
			170deg,
			rgb(0, 0, 0, 1),
			var(--bn-color1) 50%,
			var(--bn-color2)
		);
		background-color: rgba(255, 255, 255, 0.5);
		background-size: 200%;
		background-position: top left;
		position: relative;
	}

	.group .featured-bg {
		border-top-left-radius: calc(0.04 * var(--bw));
	}

	.overflow {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		right: 0;
		z-index: -1;
	}
	.group .overflow {
		width: 100%;
	}

	.overflow.hide {
		overflow: hidden;
	}

	.splash-art {
		position: absolute;
		top: 0;
		right: 0;
		z-index: -1;
		width: 100%;
		height: 100%;
	}

	.wrapper {
		display: block;
		width: 100%;
		height: 100%;
		mask-image: none;
	}
	.mask-content {
		display: block;
		width: 100%;
		height: 100%;
		position: relative;
	}

	.lite .featured-bg {
		mask-image: unset;
	}

	.lite {
		overflow: hidden;
	}
	.lite .featured-bg {
		background-image: unset;
		background-color: var(--bn-color1);
	}

	.art-pic {
		position: relative;
		display: block;
		height: 100%;
		width: 100%;
	}

	picture {
		position: absolute;
		display: block;
		width: 100%;
		height: 100%;
		top: 0;
		left: 0;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	:global(.mobileLandscape) .art-pic {
		bottom: auto;
		left: auto;
		transform: none;
	}
</style>
