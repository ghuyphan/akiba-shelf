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
				.slice(0, 5)
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
		<div class="merch-event-background custom-merch-banner {character.kind || 'character'} theme-{character.theme || 'anemo'}">
			<img
				class="custom-banner-template"
				src="/images/banner/blank/character-{character.theme || 'anemo'}.png"
				alt=""
				aria-hidden="true"
			/>
			<div class="merch-art merch-count-{featuredMerchItems.length}">
				{#each featuredMerchItems as item, i (item.name)}
					<div
						class="featured-art merch-item merch-item-{i}"
					>
						<img
							src={item.imageUrl}
							alt={item.name}
							loading="eager"
							decoding="async"
						/>
					</div>
				{/each}
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
		background:
			linear-gradient(106deg, rgba(250, 247, 235, 0.98) 0 45%, rgba(225, 241, 237, 0.68) 61%, rgba(99, 171, 166, 0.45) 100%),
			radial-gradient(circle at 82% 45%, #d9f1e7, #b9d9da 52%, #eee7d5);
	}
	.merch-event-background::before,
	.merch-event-background::after {
		position: absolute;
		content: '';
		pointer-events: none;
	}
	.merch-event-background.weapon {
		background:
			linear-gradient(106deg, rgba(250, 247, 235, 0.98) 0 43%, rgba(241, 227, 205, 0.72) 59%, rgba(125, 83, 154, 0.48) 100%),
			radial-gradient(circle at 82% 45%, #ffe5a5, #ccb6d8 54%, #eee7d5);
	}
	.merch-event-background.weapon::before {
		background-image:
			linear-gradient(118deg, transparent 0 42%, rgba(255, 235, 176, 0.7) 42.2% 43%, transparent 43.2%),
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
		background:
			linear-gradient(106deg, rgba(253, 248, 239, 0.98) 0 44%, rgba(245, 220, 220, 0.7) 61%, rgba(178, 107, 135, 0.48) 100%),
			radial-gradient(circle at 82% 45%, #ffe0de, #dbc2d6 52%, #f2eadb);
	}
	.merch-event-background.theme-2:not(.weapon) {
		background:
			linear-gradient(106deg, rgba(248, 248, 239, 0.98) 0 44%, rgba(226, 233, 198, 0.72) 61%, rgba(99, 139, 92, 0.48) 100%),
			radial-gradient(circle at 82% 45%, #eaf0c9, #bcd0b5 52%, #eee8d8);
	}
	.merch-event-background.theme-3:not(.weapon) {
		background:
			linear-gradient(106deg, rgba(248, 247, 243, 0.98) 0 44%, rgba(211, 224, 244, 0.72) 61%, rgba(88, 112, 170, 0.48) 100%),
			radial-gradient(circle at 82% 45%, #dce9ff, #bdc8df 52%, #ece7dc);
	}
	.merch-event-background.weapon.theme-1 {
		background:
			linear-gradient(106deg, rgba(251, 248, 238, 0.98) 0 43%, rgba(226, 232, 207, 0.75) 59%, rgba(89, 125, 91, 0.5) 100%),
			radial-gradient(circle at 82% 45%, #f0dfa5, #afc5ae 54%, #eee7d5);
	}
	.merch-event-background.weapon.theme-2 {
		background:
			linear-gradient(106deg, rgba(250, 247, 239, 0.98) 0 43%, rgba(222, 225, 244, 0.75) 59%, rgba(71, 91, 151, 0.5) 100%),
			radial-gradient(circle at 82% 45%, #e6d39a, #aeb9dc 54%, #eee7d5);
	}
	.merch-event-background.weapon.theme-3 {
		background:
			linear-gradient(106deg, rgba(251, 247, 239, 0.98) 0 43%, rgba(242, 218, 211, 0.75) 59%, rgba(157, 75, 73, 0.5) 100%),
			radial-gradient(circle at 82% 45%, #f7d79b, #dfb3ad 54%, #eee7d5);
	}
	.merch-event-background::before {
		inset: 0;
		background-image:
			linear-gradient(118deg, transparent 0 43%, rgba(255, 255, 255, 0.62) 43.2% 44%, transparent 44.2%),
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
		box-shadow: 0 calc(0.8 / 100 * var(--content-width)) calc(2 / 100 * var(--content-width)) rgba(40, 57, 66, 0.28);
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
	.support-1 { top: 2%; transform: rotate(4deg); }
	.support-2 { bottom: 1%; left: 3%; transform: rotate(-4deg); }
	.featured-art img,
	.support-art img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.featured-art img { object-position: center; }

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
		box-shadow: 0 calc(0.8 / 100 * var(--content-width)) calc(2 / 100 * var(--content-width)) rgba(37, 31, 43, 0.28);
		clip-path: none;
	}
	.custom-merch-banner .featured-art img {
		object-fit: cover;
	}
	.merch-count-1 .merch-item-0 {
		right: 4%;
		top: 0;
		width: 84%;
		height: 100%;
		transform: rotate(1.5deg);
	}
	.merch-count-2 .merch-item-0 {
		left: 48%;
		top: 1%;
		z-index: 2;
		width: 49%;
		height: 96%;
		transform: rotate(2.5deg);
	}
	.merch-count-2 .merch-item-1 {
		left: 3%;
		top: 5%;
		z-index: 1;
		width: 49%;
		height: 90%;
		transform: rotate(-4deg);
	}
	.merch-count-3 .merch-item-0 {
		left: 25%;
		top: 1%;
		z-index: 3;
		width: 50%;
		height: 98%;
		transform: rotate(0.5deg);
	}
	.merch-count-3 .merch-item-1 {
		left: 1%;
		top: 10%;
		z-index: 1;
		width: 39%;
		height: 82%;
		transform: rotate(-5deg);
	}
	.merch-count-3 .merch-item-2 {
		right: 1%;
		top: 9%;
		z-index: 2;
		width: 39%;
		height: 82%;
		transform: rotate(5deg);
	}
	.merch-count-4 .merch-item-0 {
		left: 2%;
		top: 3%;
		z-index: 4;
		width: 54%;
		height: 94%;
		transform: rotate(-2.5deg);
	}
	.merch-count-4 .merch-item:not(.merch-item-0) {
		right: 1%;
		width: 47%;
		height: 39%;
	}
	.merch-count-4 .merch-item-1 { top: 0; z-index: 3; transform: rotate(3.5deg); }
	.merch-count-4 .merch-item-2 { top: 31%; z-index: 2; transform: rotate(-1.5deg); }
	.merch-count-4 .merch-item-3 { bottom: 0; z-index: 1; transform: rotate(3deg); }
	.merch-count-5 .merch-item-0 {
		left: 28%;
		top: 1%;
		z-index: 5;
		width: 44%;
		height: 98%;
		transform: rotate(-0.5deg);
	}
	.merch-count-5 .merch-item:not(.merch-item-0) {
		width: 38%;
		height: 53%;
	}
	.merch-count-5 .merch-item-1 { left: 0; top: 0; z-index: 3; transform: rotate(-5deg); }
	.merch-count-5 .merch-item-2 { right: 0; top: 1%; z-index: 4; transform: rotate(5deg); }
	.merch-count-5 .merch-item-3 { left: 1%; bottom: 0; z-index: 1; transform: rotate(4deg); }
	.merch-count-5 .merch-item-4 { right: 1%; bottom: 0; z-index: 2; transform: rotate(-4deg); }
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
