<script>
	import { fly } from 'svelte/transition';
	import { t, locale } from 'svelte-i18n';
	import { parseLocalizedText } from '$lib/helpers/localize';

	export let data = {};

	$: featuredItems = data.merchItems?.length
		? data.merchItems
		: data.featuredItem
			? [data.featuredItem]
			: [];
	$: featuredNames = featuredItems.map(({ name }) => parseLocalizedText(name, $locale)).filter(Boolean).join(' · ');
	$: title = parseLocalizedText(data.title, $locale) || 'Matsuri Shelf Wishes';
	$: description = parseLocalizedText(data.description, $locale) || $t('wish.banner.wishDescription');
	$: isWeapon = data.kind === 'weapon';
	$: theme = data.theme || 'anemo';
	$: featuredLabel = isWeapon
		? featuredItems.length > 1 ? 'Featured Weapons' : 'Featured Weapon'
		: featuredItems.length > 1 ? 'Featured Characters' : 'Featured Character';
</script>

<div class="frame-content" class:weapon={isWeapon}>
	<div class="top bg-{theme}">{$t(`wish.banner.${isWeapon ? 'weapons' : 'events'}`)}</div>

	<h1 class="card-stroke" in:fly={{ x: 15, duration: 700 }}>
		<span class="{theme}-flat">{title}</span>
	</h1>

	<div class="info" in:fly={{ x: 15, duration: 700 }}>
		<div class="content">
			<div class="set card-stroke">{$t('wish.banner.probIncreased')}</div>
			<div class="desc bg-{theme}">
				<div class="icon"><i class="gi-primo-star" /></div>
				<div class="text">{$t('wish.banner.wishDescription')}</div>
			</div>
			<div class="note card-stroke">{description}</div>
		</div>
	</div>

	<div class="featured" in:fly={{ x: 10, duration: 700 }}>
		<div class="featured-name">
			<span><i class="gi-{theme} {theme}-flat" /> {featuredNames || title}</span>
			<span class="up">{$t('wish.banner.up')}</span>
		</div>
		<div class="featured-title">{featuredLabel}</div>
	</div>
</div>

<style>
	.frame-content {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		color: #565654;
		font-size: calc(1.8 / 100 * var(--content-width));
		line-height: 130%;
	}
	h1,
	.frame-content > div {
		position: absolute;
		text-align: left;
	}
	h1 {
		left: 0;
		bottom: 67%;
		max-width: 42%;
		margin: 0 4%;
		font-size: calc(4.5 / 100 * var(--content-width));
		line-height: 105%;
	}
	h1 span { display: block; }
	.top {
		top: 0;
		left: 0;
		padding: 0.3% 1.4%;
		border-radius: 2rem 4rem 4rem 2rem;
		color: #fff;
		transform: translate(-3%, -15%);
	}
	.info {
		left: 0;
		top: 40%;
		width: 40%;
		height: 45%;
		padding-left: 4%;
	}
	.content { position: relative; }
	.content::after {
		position: absolute;
		left: calc(-3.045 / 100 * var(--content-width));
		top: 0;
		width: calc(0.55 / 100 * var(--content-width));
		height: 100%;
		background: #565654;
		content: '';
	}
	.set { font-size: calc(2.4 / 100 * var(--content-width)); }
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
		overflow: hidden;
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
	.featured-title {
		width: fit-content;
		margin-top: calc(0.45 / 100 * var(--content-width));
		padding: 1% 2%;
		background: #39425d;
		color: #cfbc99;
		white-space: nowrap;
	}
	.weapon .top,
	.weapon .desc {
		background: linear-gradient(90deg, #8b5b31, #a48151);
	}
	.weapon-title {
		color: #b66e31;
	}
	.weapon .content::after {
		background: #76506e;
	}
	.weapon .featured-title {
		background: #4e3e5e;
		color: #ead19e;
	}
</style>
