<script>
	import { fly } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { assets, pageActive } from '$lib/store/stores';
	import browserState from '$lib/helpers/browserState';
	import { playSfx } from '$lib/helpers/audio/audio.svelte';
	import ResponsiveImage from './ResponsiveImage.svelte';
	import BeginnerFrame from './frames/_beginner-frame.svelte';
	import StandardFrame from './frames/_standard-frame.svelte';
	import EventsFrame from './frames/_events-frame.svelte';
	import MerchEventsFrame from './frames/_merch-events-frame.svelte';
	import WeaponsFrame from './frames/_weapons-frame.svelte';

	export let data = {};
	export let index = -1;

	let type, weapons, character, merch;
	$: ({ type, weapons, character, merch } = data);
	$: featuredMerchItems = merch
		? (character?.merchItems?.length ? character.merchItems : [character?.featuredItem])
				.filter(Boolean)
				.slice(0, 7)
		: [];

	let clientWidth;
	let clientHeight;

	let imageError = false;
	const handleimageError = () => {
		imageError = true;
	};

	const openDetails = () => {
		pageActive.set('details');
		browserState.set('details');
		return playSfx();
	};
</script>

<div
	class="card"
	bind:clientWidth
	bind:clientHeight
	style="--content-width:{clientWidth}px; --content-height:{clientHeight}px"
>
	{#if merch}
		<div
			class="merch-event-background custom-merch-banner {character.kind ||
				'character'} theme-{character.theme || 'anemo'}"
		>
			<img
				class="custom-banner-template"
				src="/images/banner/blank/character-{character.theme || 'anemo'}.png"
				alt=""
				aria-hidden="true"
			/>
			<div
				class="merch-art merch-count-{featuredMerchItems.length} {character.kind || 'character'}"
			>
				{#if character.kind === 'weapon'}
					{@const legendaryWeapons = featuredMerchItems.filter((item) => item.rarity === 5)}
					{@const rateUpWeapons = featuredMerchItems.filter((item) => item.rarity === 4)}
					<div class="weapon-legendary-lineup weapon-legendary-count-{legendaryWeapons.length}">
						{#each legendaryWeapons as item, i (item.name)}
							<div class="featured-art weapon-legendary weapon-legendary-{i} rarity-5">
								<img src={item.imageUrl} alt={item.name} loading="eager" decoding="async" />
							</div>
						{/each}
					</div>
					<div class="weapon-rateup-lineup weapon-rateup-count-{rateUpWeapons.length}">
						{#each rateUpWeapons as item, i (item.name)}
							<div class="featured-art weapon-rateup weapon-rateup-{i} rarity-4">
								<img src={item.imageUrl} alt={item.name} loading="eager" decoding="async" />
							</div>
						{/each}
					</div>
				{:else}
					{#each featuredMerchItems as item, i (item.name)}
						<div class="featured-art merch-item merch-item-{i} rarity-{item.rarity}">
							<img src={item.imageUrl} alt={item.name} loading="eager" decoding="async" />
						</div>
					{/each}
				{/if}
			</div>
		</div>
		<div class="frame skeleton-event merch-frame">
			<MerchEventsFrame data={character} />
		</div>
	{:else if type === 'beginner'}
		<ResponsiveImage
			on:error={handleimageError}
			isError={imageError}
			src={$assets['beginner']}
			alt="Weapon Banner"
			wrapperClass="card-image skeleton"
		/>
		<div class="frame skeleton">
			<BeginnerFrame {character} />
		</div>
	{:else if type === 'weapons'}
		<ResponsiveImage
			on:error={handleimageError}
			isError={imageError}
			src={$assets[`${weapons.name}`]}
			alt="Weapon Banner"
			wrapperClass="card-image skeleton-event"
		/>
		<div class="frame skeleton-event">
			<WeaponsFrame data={weapons} />
		</div>
	{:else if type === 'events'}
		<ResponsiveImage
			on:error={handleimageError}
			isError={imageError}
			src={$assets[`${character.name}`]}
			alt="Character Event Banner"
			wrapperClass="card-image skeleton-event"
		/>
		{#if !character.name || imageError}
			<div class="character" in:fly={{ x: 20, duration: 850 }}>
				<img
					class="splash-art"
					src={$assets[`splash-art/${character.character}`]}
					alt="character"
					on:error={(e) => e.target.remove()}
					crossorigin="anonymous"
				/>
			</div>
		{/if}
		<div class="frame skeleton-event">
			<EventsFrame data={character} event2={index === 2} />
		</div>
	{:else if type === 'standard'}
		<ResponsiveImage
			on:error={handleimageError}
			isError={imageError}
			src={$assets[`${character.name}`]}
			alt="Standard Banner"
			wrapperClass="card-image {imageError ? 'skeleton' : ''}"
		/>
		<div class="frame">
			<StandardFrame {data} />
		</div>
	{/if}

	<button class="detail" on:click={openDetails}> {$t('details.text')} </button>
</div>

<style>
	.card,
	.frame {
		width: 100%;
		max-width: 100%;
		max-height: 100%;
		aspect-ratio: 27/14;
	}

	.frame.skeleton-event,
	.card :global(.card-image.skeleton-event) {
		aspect-ratio: 1080/533;
	}

	.frame.skeleton,
	.card :global(.card-image.skeleton) {
		aspect-ratio: 738.55/382.95;
	}

	.card {
		position: relative;
	}
	.merch-event-background {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: linear-gradient(
				106deg,
				rgba(250, 247, 235, 0.98) 0 45%,
				rgba(225, 241, 237, 0.68) 61%,
				rgba(99, 171, 166, 0.45) 100%
			),
			radial-gradient(circle at 82% 45%, #d9f1e7, #b9d9da 52%, #eee7d5);
	}
	.merch-event-background::before,
	.merch-event-background::after {
		position: absolute;
		content: '';
		pointer-events: none;
	}
	.merch-event-background.weapon {
		background: linear-gradient(
				106deg,
				rgba(250, 247, 235, 0.98) 0 43%,
				rgba(241, 227, 205, 0.72) 59%,
				rgba(125, 83, 154, 0.48) 100%
			),
			radial-gradient(circle at 82% 45%, #ffe5a5, #ccb6d8 54%, #eee7d5);
	}
	.merch-event-background.weapon::before {
		background-image: linear-gradient(
				118deg,
				transparent 0 42%,
				rgba(255, 235, 176, 0.7) 42.2% 43%,
				transparent 43.2%
			),
			repeating-linear-gradient(45deg, transparent 0 8%, rgba(132, 91, 156, 0.12) 8.2% 8.6%);
	}
	.merch-event-background.weapon .merch-shard {
		background: rgba(127, 77, 154, 0.19);
	}
	.merch-event-background.weapon .merch-glow {
		background: radial-gradient(ellipse, rgba(255, 221, 137, 0.88), transparent 67%);
	}
	.merch-event-background.weapon:not(.custom-merch-banner) .featured-art {
		clip-path: polygon(5% 0, 100% 6%, 94% 100%, 13% 100%);
		transform: rotate(2deg);
	}
	.merch-event-background.theme-1:not(.weapon) {
		background: linear-gradient(
				106deg,
				rgba(253, 248, 239, 0.98) 0 44%,
				rgba(245, 220, 220, 0.7) 61%,
				rgba(178, 107, 135, 0.48) 100%
			),
			radial-gradient(circle at 82% 45%, #ffe0de, #dbc2d6 52%, #f2eadb);
	}
	.merch-event-background.theme-2:not(.weapon) {
		background: linear-gradient(
				106deg,
				rgba(248, 248, 239, 0.98) 0 44%,
				rgba(226, 233, 198, 0.72) 61%,
				rgba(99, 139, 92, 0.48) 100%
			),
			radial-gradient(circle at 82% 45%, #eaf0c9, #bcd0b5 52%, #eee8d8);
	}
	.merch-event-background.theme-3:not(.weapon) {
		background: linear-gradient(
				106deg,
				rgba(248, 247, 243, 0.98) 0 44%,
				rgba(211, 224, 244, 0.72) 61%,
				rgba(88, 112, 170, 0.48) 100%
			),
			radial-gradient(circle at 82% 45%, #dce9ff, #bdc8df 52%, #ece7dc);
	}
	.merch-event-background.weapon.theme-1 {
		background: linear-gradient(
				106deg,
				rgba(251, 248, 238, 0.98) 0 43%,
				rgba(226, 232, 207, 0.75) 59%,
				rgba(89, 125, 91, 0.5) 100%
			),
			radial-gradient(circle at 82% 45%, #f0dfa5, #afc5ae 54%, #eee7d5);
	}
	.merch-event-background.weapon.theme-2 {
		background: linear-gradient(
				106deg,
				rgba(250, 247, 239, 0.98) 0 43%,
				rgba(222, 225, 244, 0.75) 59%,
				rgba(71, 91, 151, 0.5) 100%
			),
			radial-gradient(circle at 82% 45%, #e6d39a, #aeb9dc 54%, #eee7d5);
	}
	.merch-event-background.weapon.theme-3 {
		background: linear-gradient(
				106deg,
				rgba(251, 247, 239, 0.98) 0 43%,
				rgba(242, 218, 211, 0.75) 59%,
				rgba(157, 75, 73, 0.5) 100%
			),
			radial-gradient(circle at 82% 45%, #f7d79b, #dfb3ad 54%, #eee7d5);
	}
	.merch-event-background::before {
		inset: 0;
		background-image: linear-gradient(
				118deg,
				transparent 0 43%,
				rgba(255, 255, 255, 0.62) 43.2% 44%,
				transparent 44.2%
			),
			repeating-linear-gradient(135deg, transparent 0 7%, rgba(255, 255, 255, 0.12) 7.2% 7.5%);
	}
	.merch-event-background::after {
		left: 43%;
		top: -28%;
		width: 18%;
		height: 155%;
		background: rgba(255, 255, 255, 0.38);
		transform: rotate(13deg);
	}
	.merch-glow {
		position: absolute;
		right: 5%;
		top: 3%;
		width: 49%;
		height: 94%;
		background: radial-gradient(ellipse, rgba(255, 250, 211, 0.84), transparent 67%);
	}
	.merch-shard {
		position: absolute;
		background: rgba(79, 139, 145, 0.16);
		clip-path: polygon(50% 0, 100% 100%, 0 76%);
	}
	.shard-one {
		right: 31%;
		top: -16%;
		width: 23%;
		height: 76%;
		transform: rotate(18deg);
	}
	.shard-two {
		right: -2%;
		bottom: -18%;
		width: 24%;
		height: 70%;
		transform: rotate(-19deg);
	}
	.merch-art {
		position: absolute;
		inset: 0 0 0 43%;
		z-index: 1;
		overflow: hidden;
	}
	.featured-art,
	.support-art {
		position: absolute;
		overflow: hidden;
		background: rgba(255, 255, 255, 0.55);
		border: calc(0.12 / 100 * var(--content-width)) solid rgba(255, 255, 255, 0.88);
		box-shadow: 0 calc(0.8 / 100 * var(--content-width)) calc(2 / 100 * var(--content-width))
			rgba(40, 57, 66, 0.28);
		transform: rotate(-3deg);
	}
	.featured-art {
		right: 4%;
		top: -5%;
		width: 57%;
		height: 110%;
		clip-path: polygon(14% 0, 100% 0, 91% 100%, 0 100%);
	}
	.support-art {
		width: 31%;
		height: 46%;
		left: 7%;
		clip-path: polygon(9% 0, 100% 4%, 91% 100%, 0 96%);
	}
	.support-1 {
		top: 2%;
		transform: rotate(4deg);
	}
	.support-2 {
		bottom: 1%;
		left: 3%;
		transform: rotate(-4deg);
	}
	.featured-art img,
	.support-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.featured-art img {
		object-position: center;
	}

	/* Use the simulator's original blank elemental banner as the base layer. */
	.custom-merch-banner {
		background: #faf7f0;
	}
	.custom-banner-template {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
	}
	.custom-merch-banner .merch-art {
		inset: 3% 1.5% 3% 49%;
		overflow: visible;
	}
	.custom-merch-banner .featured-art {
		right: auto;
		bottom: auto;
		left: auto;
		top: auto;
		border: calc(0.18 / 100 * var(--content-width)) solid rgba(255, 248, 226, 0.88);
		border-radius: calc(1.2 / 100 * var(--content-width));
		background: rgba(255, 255, 255, 0.22);
		box-shadow: 0 calc(0.8 / 100 * var(--content-width)) calc(2 / 100 * var(--content-width))
			rgba(37, 31, 43, 0.28);
		clip-path: none;
	}
	.custom-merch-banner .featured-art img {
		object-fit: cover;
	}
	.custom-merch-banner .featured-art.rarity-5 {
		border-color: rgba(255, 218, 122, 0.96);
		box-shadow: 0 0 calc(1.2 / 100 * var(--content-width)) rgba(255, 198, 71, 0.5),
			0 calc(0.9 / 100 * var(--content-width)) calc(2.2 / 100 * var(--content-width))
				rgba(78, 48, 12, 0.34);
	}
	.custom-merch-banner .featured-art.rarity-4 {
		border-color: rgba(225, 202, 255, 0.9);
	}
	.custom-merch-banner .merch-art.character .merch-item-0 {
		border: 0;
		border-radius: 0;
		box-shadow: none;
		clip-path: polygon(4% 0, 100% 0, 100% 100%, 0 100%);
	}
	.custom-merch-banner .merch-art.character .merch-item:not(.merch-item-0) {
		border-width: calc(0.1 / 100 * var(--content-width));
		border-color: rgba(255, 255, 255, 0.82);
		border-radius: calc(0.45 / 100 * var(--content-width));
		box-shadow: 0 calc(0.35 / 100 * var(--content-width)) calc(1 / 100 * var(--content-width))
			rgba(29, 54, 55, 0.2);
	}
	.custom-merch-banner .merch-art.weapon .featured-art {
		border: 0;
		border-radius: 0;
		clip-path: polygon(4% 0, 100% 0, 96% 100%, 0 100%);
	}
	.custom-merch-banner .merch-art.weapon .featured-art.rarity-5 {
		box-shadow: inset 0 0 0 calc(0.18 / 100 * var(--content-width)) rgba(255, 220, 119, 0.95),
			0 0 calc(1 / 100 * var(--content-width)) rgba(255, 196, 61, 0.42),
			0 calc(0.55 / 100 * var(--content-width)) calc(1.3 / 100 * var(--content-width))
				rgba(79, 49, 14, 0.3);
	}
	.custom-merch-banner .merch-art.weapon .featured-art.rarity-4 {
		box-shadow: inset 0 0 0 calc(0.13 / 100 * var(--content-width)) rgba(225, 202, 255, 0.9),
			0 calc(0.35 / 100 * var(--content-width)) calc(1 / 100 * var(--content-width))
				rgba(46, 31, 66, 0.22);
	}
	.custom-merch-banner.weapon::after {
		left: 55%;
		top: 0;
		width: 45%;
		height: 100%;
		background: linear-gradient(145deg, rgba(255, 190, 92, 0.34), rgba(179, 54, 44, 0.46)),
			repeating-linear-gradient(
				135deg,
				rgba(255, 255, 255, 0.08) 0 1px,
				transparent 1px 12px
			);
		clip-path: polygon(18% 0, 100% 0, 100% 100%, 0 100%);
		transform: none;
	}
	/* Product photos use an editorial showcase rather than character-art cutouts. */
	.merch-art .merch-item-0 {
		left: 8%;
		right: auto;
		top: 2%;
		width: 84%;
		height: 94%;
		z-index: 5;
		transform: none;
	}
	.merch-count-2 .merch-item-0 {
		left: 1%;
		top: 2%;
		z-index: 2;
		width: 62%;
		height: 92%;
	}
	.merch-count-2 .merch-item-1 {
		left: 65%;
		top: 15%;
		z-index: 1;
		width: 34%;
		height: 70%;
		transform: none;
	}
	.merch-count-3 .merch-item-0 {
		left: 1%;
		top: 2%;
		z-index: 3;
		width: 62%;
		height: 92%;
	}
	.merch-count-3 .merch-item-1 {
		left: 65%;
		top: 2%;
		z-index: 2;
		width: 34%;
		height: 44%;
		transform: none;
	}
	.merch-count-3 .merch-item-2 {
		left: 65%;
		right: auto;
		top: 50%;
		z-index: 1;
		width: 34%;
		height: 44%;
		transform: none;
	}
	.merch-count-4 .merch-item-0 {
		left: 1%;
		top: 2%;
		z-index: 4;
		width: 62%;
		height: 92%;
		transform: none;
	}
	.merch-count-4 .merch-item:not(.merch-item-0) {
		left: 65%;
		right: auto;
		width: 34%;
		height: 28.5%;
		transform: none;
	}
	.merch-count-4 .merch-item-1 {
		top: 2%;
		z-index: 3;
	}
	.merch-count-4 .merch-item-2 {
		top: 34%;
		z-index: 2;
	}
	.merch-count-4 .merch-item-3 {
		top: 66%;
		bottom: auto;
		z-index: 1;
	}
	.merch-count-5 .merch-item-0 {
		left: 3%;
		top: 2%;
		z-index: 5;
		width: 45%;
		height: 58%;
		transform: none;
	}
	.merch-count-5 .merch-item:not(.merch-item-0) {
		transform: none;
	}
	.merch-count-5 .merch-item-1 {
		left: 52%;
		top: 2%;
		z-index: 4;
		width: 45%;
		height: 58%;
	}
	.merch-count-5 .merch-item-2 {
		left: 1%;
		right: auto;
		top: 64%;
		z-index: 3;
		width: 31%;
		height: 27%;
	}
	.merch-count-5 .merch-item-3 {
		left: 34.5%;
		bottom: auto;
		top: 64%;
		z-index: 2;
		width: 31%;
		height: 27%;
	}
	.merch-count-5 .merch-item-4 {
		left: 68%;
		right: auto;
		bottom: auto;
		top: 64%;
		z-index: 1;
		width: 31%;
		height: 27%;
	}

	/* Weapon wishes use clean photo cards: large 5-star showcases with smaller rate-up cards. */
	.custom-merch-banner .merch-art.weapon {
		inset: 2% 0 2% 48%;
		overflow: hidden;
	}
	.weapon-legendary-lineup,
	.weapon-rateup-lineup {
		position: absolute;
		inset: 0;
	}
	.custom-merch-banner .merch-art.weapon .featured-art {
		bottom: auto;
		border-radius: calc(0.45 / 100 * var(--content-width));
		clip-path: none;
		transform: none;
	}
	.custom-merch-banner .merch-art.weapon .featured-art img {
		object-position: center;
	}
	.custom-merch-banner .merch-art.weapon .weapon-legendary {
		top: 9%;
		width: 43%;
		height: 55%;
		filter: drop-shadow(
			0 calc(0.75 / 100 * var(--content-width)) calc(1 / 100 * var(--content-width))
				rgba(79, 43, 8, 0.42)
		);
	}
	.weapon-legendary-count-1 .weapon-legendary-0 {
		left: 2%;
		top: 8%;
		width: 43%;
		height: 74%;
		z-index: 12;
	}
	.custom-merch-banner
		.merch-art.weapon
		.weapon-legendary-count-1
		.weapon-legendary {
		width: 43%;
		height: 74%;
	}
	.weapon-legendary-count-2 .weapon-legendary-0 {
		left: 4%;
		z-index: 5;
	}
	.weapon-legendary-count-2 .weapon-legendary-1 {
		left: 52%;
		z-index: 6;
	}
	.custom-merch-banner .merch-art.weapon .weapon-rateup {
		width: 28%;
		height: 20%;
		filter: drop-shadow(
			0 calc(0.45 / 100 * var(--content-width)) calc(0.65 / 100 * var(--content-width))
				rgba(45, 27, 57, 0.4)
		);
	}
	.weapon-rateup-count-1 .weapon-rateup-0 {
		left: 61%;
		top: 18%;
		width: 36%;
		height: 60%;
		z-index: 8;
	}
	.custom-merch-banner .merch-art.weapon .weapon-rateup-count-1 .weapon-rateup {
		width: 36%;
		height: 60%;
	}
	.weapon-rateup-count-2 .weapon-rateup-0 {
		left: 42%;
		top: 21%;
		width: 27%;
		height: 56%;
		z-index: 9;
	}
	.weapon-rateup-count-2 .weapon-rateup-1 {
		left: 71%;
		top: 21%;
		width: 27%;
		height: 56%;
		z-index: 8;
	}
	.custom-merch-banner .merch-art.weapon .weapon-rateup-count-2 .weapon-rateup {
		width: 27%;
		height: 56%;
	}
	.weapon-rateup-count-3 .weapon-rateup-0 {
		left: 36%;
		top: 18%;
		width: 25%;
		height: 58%;
		z-index: 10;
	}
	.weapon-rateup-count-3 .weapon-rateup-1 {
		left: 55%;
		top: 18%;
		width: 25%;
		height: 58%;
		z-index: 9;
	}
	.weapon-rateup-count-3 .weapon-rateup-2 {
		left: 74%;
		top: 18%;
		width: 25%;
		height: 58%;
		z-index: 8;
	}
	.custom-merch-banner .merch-art.weapon .weapon-rateup-count-3 .weapon-rateup {
		width: 25%;
		height: 58%;
	}
	.weapon-rateup-count-4 .weapon-rateup {
		width: 13.5%;
		height: 22%;
	}
	.custom-merch-banner .merch-art.weapon .weapon-rateup-count-4 .weapon-rateup {
		width: 13.5%;
		height: 22%;
	}
	.weapon-rateup-count-4 .weapon-rateup-0 {
		left: 42%;
		top: 66%;
		z-index: 12;
	}
	.weapon-rateup-count-4 .weapon-rateup-1 {
		left: 56.5%;
		top: 66%;
		z-index: 11;
	}
	.weapon-rateup-count-4 .weapon-rateup-2 {
		left: 71%;
		top: 66%;
		z-index: 10;
	}
	.weapon-rateup-count-4 .weapon-rateup-3 {
		left: 85.5%;
		top: 66%;
		z-index: 9;
	}
	.weapon-rateup-count-5 .weapon-rateup {
		top: 66%;
		width: 22%;
		height: 22%;
	}
	.custom-merch-banner .merch-art.weapon .weapon-rateup-count-5 .weapon-rateup {
		top: 66%;
		width: 22%;
		height: 22%;
	}
	.weapon-rateup-count-5 .weapon-rateup-0 {
		left: 1%;
		z-index: 12;
	}
	.weapon-rateup-count-5 .weapon-rateup-1 {
		left: 20%;
		z-index: 11;
	}
	.weapon-rateup-count-5 .weapon-rateup-2 {
		left: 39%;
		z-index: 10;
	}
	.weapon-rateup-count-5 .weapon-rateup-3 {
		left: 58%;
		z-index: 9;
	}
	.weapon-rateup-count-5 .weapon-rateup-4 {
		left: 77%;
		z-index: 8;
	}
	.merch-frame {
		z-index: 2;
		pointer-events: none;
	}
	.frame,
	.card :global(.card-image) {
		position: absolute;
		bottom: 0;
		left: 0;
	}

	.character {
		position: absolute;
		height: 100%;
		right: 0;
		top: 0;
		overflow: hidden;
	}

	img.splash-art {
		height: 150%;
	}

	.detail {
		position: absolute;
		left: 5%;
		bottom: 8%;
		background-color: #eee8e3;
		color: rgba(0, 0, 0, 0.5);
		padding: calc(0.5 / 100 * var(--content-width)) calc(2.5 / 100 * var(--content-width));
		border-radius: 20px;
		border: #e2d7b6 0.1rem solid;
		font-size: calc(1.5 / 100 * var(--content-width));
		transition: all 0.2s;
	}

	.detail:hover {
		background-color: #e0ddd4;
		color: rgba(0, 0, 0, 1);
	}
</style>
