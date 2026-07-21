<script>
	import { fly } from 'svelte/transition';
	import { t, locale } from 'svelte-i18n';
	import { parseLocalizedText } from '$lib/helpers/localize';
	import { onMount } from 'svelte';

	export let data = {};
	let now = Date.now();

	onMount(() => {
		const timer = window.setInterval(() => {
			now = Date.now();
		}, 60_000);
		return () => window.clearInterval(timer);
	});

	const themePalettes = {
		anemo: {
			title: '#2d8f7e',
			panel: '#2a5a55'
		},
		geo: {
			title: '#b8862e',
			panel: '#6b5127'
		},
		electro: {
			title: '#7b5ec4',
			panel: '#463166'
		},
		dendro: {
			title: '#4d8a1e',
			panel: '#345a1a'
		},
		hydro: {
			title: '#2c7ab8',
			panel: '#1e4a6e'
		},
		pyro: {
			title: '#d04a3a',
			panel: '#6e2a22'
		},
		cryo: {
			title: '#2ea0b2',
			panel: '#1e5a66'
		}
	};

	$: featuredItems = data.merchItems?.length
		? data.merchItems
		: data.featuredItem
		? [data.featuredItem]
		: [];

	$: isWeapon = data.kind === 'weapon';
	$: legendaryWeaponNames = featuredItems
		.filter((item) => item.rarity === 5)
		.slice(0, 2)
		.map((item) => parseLocalizedText(item.name, $locale))
		.filter(Boolean);

	$: primaryFeaturedName = isWeapon && legendaryWeaponNames.length
		? legendaryWeaponNames.join(' / ')
		: featuredItems[0]?.name
		? parseLocalizedText(featuredItems[0].name, $locale)
		: title;

	$: featuredRarity = Math.max(0, Math.min(5, Math.trunc(Number(featuredItems[0]?.rarity) || 0)));

	$: title = parseLocalizedText(data.title, $locale) || 'Matsuri Shelf Wishes';

	$: description =
		parseLocalizedText(data.description, $locale) || $t('wish.banner.wishDescription');

	$: theme = data.theme || 'anemo';
	$: featuredElement =
		featuredItems.find((item) => item.rarity === 5)?.vision || featuredItems[0]?.vision || theme;
	$: palette = themePalettes[theme] || themePalettes.anemo;
	$: endTime = data.endsAt ? Date.parse(data.endsAt) : Number.NaN;
	$: remaining = Number.isFinite(endTime) ? Math.max(0, endTime - now) : null;
	$: days = remaining === null ? null : Math.floor(remaining / 86_400_000);
	$: hours = remaining === null ? null : Math.floor((remaining % 86_400_000) / 3_600_000);

	$: featuredLabel = isWeapon
		? featuredItems.length > 1
			? $t('wish.banner.featuredWeapons')
			: $t('wish.banner.featuredWeapon')
		: featuredItems.length > 1
		? $t('wish.banner.featuredCharacters')
		: $t('wish.banner.featuredCharacter');
</script>

<div
	class="frame-content"
	class:weapon={isWeapon}
	style="--theme-title: {palette.title}; --theme-panel: {palette.panel};"
>
	<div class="top bg-{theme}">
		{$t(`wish.banner.${isWeapon ? 'weapons' : 'events'}`)}
	</div>

	<h1 class="card-stroke" in:fly={{ x: 15, duration: 700 }}>
		<span>{title}</span>
	</h1>

	<div class="info" in:fly={{ x: 15, duration: 700 }}>
		<div class="content">
			<div class="set card-stroke">
				{$t('wish.banner.probIncreased')}
			</div>

			<div class="desc bg-{theme}">
				<div class="icon">
					<i class="gi-primo-star" />
				</div>

				<div class="text">
					{$t('wish.banner.wishDescription')}
				</div>
			</div>

			<div class="note card-stroke">
				{description}
			</div>

			{#if remaining !== null}
				<div class="schedule card-stroke" aria-label="Banner time remaining">
					◷ {days}d {hours}h
				</div>
			{/if}
		</div>
	</div>

	<div class="featured" in:fly={{ x: 10, duration: 700 }}>
		<div class="featured-stack">
			<div class="featured-name">
				<span>
					{#if !isWeapon}
						<i class="gi-{featuredElement} {featuredElement}-flat" />
					{/if}
					{primaryFeaturedName}
				</span>

				<span class="up">
					{$t('wish.banner.up')}
				</span>
			</div>

			{#if featuredRarity > 0}
				<div class="merch-stars" aria-label={`${featuredRarity}-star rarity`}>
					{#each Array(featuredRarity) as _}
						<i class="gi-star" aria-hidden="true" />
					{/each}
				</div>
			{/if}

			<div class="featured-title">
				{featuredLabel}
			</div>
		</div>
	</div>
</div>

<style>
	.schedule {
		margin-top: 0.55em;
		font-weight: 700;
	}

	.frame-content {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		overflow: hidden;
		color: #565654;
		font-size: calc(1.8 / 100 * var(--content-width));
		line-height: 130%;
	}

	.frame-content::before,
	.frame-content::after {
		position: absolute;
		inset: 0;
		z-index: 0;
		content: '';
		pointer-events: none;
	}

	.frame-content::before {
		background: radial-gradient(
				circle at 36% 64%,
				transparent 0 23%,
				rgba(211, 196, 167, 0.22) 23.2% 23.5%,
				transparent 23.7%
			),
			radial-gradient(
				circle at 36% 64%,
				transparent 0 34%,
				rgba(211, 196, 167, 0.12) 34.2% 34.45%,
				transparent 34.7%
			),
			radial-gradient(
				circle at 36% 64%,
				transparent 0 44%,
				rgba(211, 196, 167, 0.08) 44.15% 44.35%,
				transparent 44.55%
			);
	}

	.frame-content::after {
		background-image: repeating-linear-gradient(
				90deg,
				rgba(208, 196, 171, 0.06) 0 1px,
				transparent 1px 52px
			),
			repeating-linear-gradient(0deg, rgba(208, 196, 171, 0.05) 0 1px, transparent 1px 52px);
		opacity: 0.34;
		-webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.9) 0 48%, transparent 72%);
		mask-image: linear-gradient(to right, rgba(0, 0, 0, 0.9) 0 48%, transparent 72%);
	}

	h1,
	.frame-content > div {
		position: absolute;
		z-index: 1;
		text-align: left;
	}

	h1 {
		left: 0;
		bottom: 67%;
		max-width: 42%;
		margin: 0 4%;
		font-size: calc(4.5 / 100 * var(--content-width));
		line-height: 92%;
		letter-spacing: -0.02em;
	}

	h1 span {
		display: block;
		color: #4f4e4b;
	}

	h1 span::first-line {
		color: var(--theme-title);
	}

	.top {
		top: 0;
		left: 0;
		z-index: 3;
		padding: 0.42% 1.65%;
		border-radius: 1.3rem 0.25rem 0.25rem 1.3rem;
		color: #fff;
		line-height: 120%;
		box-shadow: 0 calc(0.14 / 100 * var(--content-width)) calc(0.45 / 100 * var(--content-width))
			rgba(0, 0, 0, 0.16);
		transform: translate(-1%, -2%);
	}

	.top::after {
		position: absolute;
		top: 0;
		right: calc(-1.45 / 100 * var(--content-width));
		width: calc(2.4 / 100 * var(--content-width));
		height: 100%;
		background: inherit;
		clip-path: polygon(0 0, 100% 0, 58% 100%, 0 100%);
		content: '';
	}

	.top::before {
		position: absolute;
		right: calc(-0.78 / 100 * var(--content-width));
		bottom: 0;
		z-index: 1;
		width: calc(0.9 / 100 * var(--content-width));
		height: calc(0.2 / 100 * var(--content-width));
		background: rgba(255, 255, 255, 0.32);
		content: '';
		transform: rotate(-18deg);
		transform-origin: right center;
	}

	.info {
		left: 0;
		top: 40%;
		width: 40%;
		height: 45%;
		padding-left: 4%;
	}

	.content {
		position: relative;
	}

	.content::after {
		position: absolute;
		left: calc(-3.045 / 100 * var(--content-width));
		top: 0;
		width: calc(0.55 / 100 * var(--content-width));
		height: 100%;
		background: #565654;
		content: '';
	}

	.set {
		font-size: calc(2.4 / 100 * var(--content-width));
	}

	.desc {
		display: flex;
		align-items: center;
		min-height: calc(9 / 100 * var(--content-height));
		margin: calc(0.7 / 100 * var(--content-width)) 0;
		color: #fff;
		opacity: 0.9;
	}

	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: calc(1 / 100 * var(--content-width));
		font-size: calc(1.1 / 100 * var(--content-width));
	}

	.desc .text {
		width: calc(32.5 / 100 * var(--content-width));
		padding: calc(0.3 / 100 * var(--content-width));
	}

	.note {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.featured {
		left: 54%;
		bottom: 8%;
		width: 39%;
		filter: drop-shadow(0 0.3rem 0.5rem rgba(0, 0, 0, 0.55));
	}

	.featured-stack {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		width: fit-content;
		max-width: 100%;
	}

	.featured-name {
		position: relative;
		display: inline-flex;
		align-items: flex-start;
		gap: calc(0.7 / 100 * var(--content-width));
		max-width: 100%;
		color: #fff;
		font-size: calc(2.8 / 100 * var(--content-width));
		line-height: 100%;
		text-shadow: 0 0 0.15rem #565654;
		-webkit-text-stroke: 0.02rem #565654;
	}

	.featured-name > span:first-child {
		display: block;
		min-width: 0;
		padding: 0.18em 0.35em 0.22em;
		overflow: hidden;
		background: rgba(45, 42, 39, 0.82);
		box-shadow: 0 0.18em 0.45em rgba(0, 0, 0, 0.28);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.up {
		flex: none;
		color: #fff664;
		font-size: calc(2 / 100 * var(--content-width));
		text-transform: uppercase;
		text-shadow: 0 0 0.4rem #f79c09;
		-webkit-text-stroke: 0.05rem #e7a12e;
		transform: translateY(-35%);
	}

	.merch-stars {
		display: flex;
		align-items: center;
		gap: calc(0.18 / 100 * var(--content-width));
		width: fit-content;
		margin-top: calc(0.35 / 100 * var(--content-width));
		margin-bottom: calc(0.38 / 100 * var(--content-width));
		color: #f5c84c;
		font-size: calc(2.3 / 100 * var(--content-width));
		line-height: 1;
		text-shadow: 0 calc(0.12 / 100 * var(--content-width)) calc(0.35 / 100 * var(--content-width))
			rgba(91, 53, 7, 0.58);
		-webkit-text-stroke: 0.02rem #b57617;
	}

	.merch-stars .gi-star {
		display: block;
	}

	.featured-title {
		width: fit-content;
		max-width: 100%;
		padding: 1% 2%;
		overflow: hidden;
		background: var(--theme-panel);
		color: #f2e4c4;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.weapon .content::after {
		background: #76506e;
	}

	.weapon .featured {
		left: 50%;
		bottom: 18%;
		width: 46%;
	}

	.weapon .featured-name {
		font-size: calc(2.15 / 100 * var(--content-width));
		line-height: 94%;
	}

	.weapon .featured-name > span:first-child {
		max-width: calc(35 / 100 * var(--content-width));
		overflow: visible;
		text-overflow: clip;
		white-space: normal;
	}

	.weapon .merch-stars {
		margin-top: calc(0.28 / 100 * var(--content-width));
		margin-bottom: 0;
		font-size: calc(1.8 / 100 * var(--content-width));
	}

	.weapon .featured-title {
		display: none;
	}
</style>
