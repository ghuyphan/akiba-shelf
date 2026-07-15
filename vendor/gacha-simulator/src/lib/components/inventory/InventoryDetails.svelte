<script>
	import { createEventDispatcher, getContext, onMount, setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';

	import { assets, viewportHeight, viewportWidth } from '$lib/store/stores';
	import HistoryIDB from '$lib/store/historyIdb';
	import { getName } from '$lib/helpers/nameText';
	import { playSfx } from '$lib/helpers/audio/audio.svelte';

	import Share from '$lib/components/utility/ShareScreenshot.svelte';
	import OutfitToggle from './_outfit-toggle.svelte';
	import { getMerchItems } from '$lib/helpers/merch';

	export let name = '';
	export let outfit = '';

	$: splatterWidth = $viewportHeight > $viewportWidth ? $viewportWidth : $viewportHeight;
	$: splatterStyle = `width: ${splatterWidth}px; height: ${splatterWidth}px`;

	let rarity = 0;
	let time = '';
	let type = '';
	let vision = '';
	let weaponType = '';
	let countInfo = 0;
	let refineExtra = '';
	$: isMerch = getMerchItems().some((item) => item.name === name);
	$: detailBackground = $assets['detailbg.webp'];

	onMount(async () => {
		if (!name) return;
		const dt = await HistoryIDB.getByName(name);
		({ time, vision, type, weaponType, rarity } = dt[0]);
		const count = dt.length;
		if (isMerch) {
			countInfo = `Owned ×${count}`;
		} else if (type === 'weapon') {
			refineExtra = $t(`inventory.extra`, { values: { count: `5 + ${count - 5}` } });
			countInfo = $t(`inventory.refinement`, {
				values: { count: count > 5 ? refineExtra : count }
			});
		} else {
			refineExtra = $t(`inventory.extra`, { values: { count: `6 + ${count - 7}` } });
			countInfo = $t(`inventory.constellation`, {
				values: { count: count > 7 ? refineExtra : count - 1 }
			});
		}
	});

	const dispatch = createEventDispatcher();
	const closeHandle = () => {
		playSfx('close');
		dispatch('close');
	};

	const refreshAfterOutfitChanged = getContext('refreshList');
	const outfitChanger = {
		applyChange() {
			refreshAfterOutfitChanged(name, outfit);
			playSfx();
		},
		selectOutfit(val) {
			outfit = val;
			playSfx();
		}
	};
	setContext('outfitChanger', outfitChanger);
</script>

<div
	class="wish-result"
	class:merch={isMerch}
	in:fade={{ duration: 200 }}
	out:fade={{ duration: 100 }}
	style="height: {$viewportHeight}px; background-image: url({detailBackground})"
>
	<div class="container">
		<button class="close" on:click={closeHandle}>
			<i class="gi-close" />
		</button>

		{#if !isMerch}<OutfitToggle charName={name} />{/if}

		<div class="splatter" style={splatterStyle}>
			{#if isMerch}
				<div class="splash-art merch-result star{rarity}">
					<img
						src={$assets[`splash-art/${name}`]}
						alt={name}
						on:error={(e) => e.target.remove()}
					/>
				</div>
			{:else if type === 'weapon'}
				<div class="splash-art weapon {weaponType}-parent">
					<img
						src={$assets[name]}
						alt={name}
						class={weaponType}
						on:error={(e) => e.target.remove()}
						crossorigin="anonymous"
					/>
				</div>
			{:else}
				<img
					src={$assets[`splash-art/${outfit || name}`]}
					alt={getName(name)}
					class="splash-art"
					on:error={(e) => e.target.remove()}
					crossorigin="anonymous"
				/>
			{/if}

			<div class="info">
				{#if vision}
					<img
						src={$assets[`icon-${vision}.svg`]}
						alt="Vision {vision}"
						class="anim vision filter-drop {vision}"
						crossorigin="anonymous"
					/>
				{:else}
					<i class="anim elemen gi-{weaponType}" />
				{/if}
				<div class="name">
					<div class="text">
						{isMerch ? name : type === 'weapon' ? $t(name) : $t(`${name}.name`)}
					</div>
					<div class="star">
						{#each Array(rarity) as _, i (i)}
							<i class="gi-star" />
						{/each}
					</div>
				</div>
			</div>
		</div>
		<div class="detail">
			<span class="count"> {countInfo} </span>
			<span> <small> {$t('inventory.firstSummon', { values: { date: time } })}: </small></span>
		</div>
		<div class="share">
			<Share />
		</div>
	</div>
</div>

<style>
	.close {
		position: fixed;
		top: 2%;
		right: 2%;
		z-index: 10;
	}

	:global(.mobile) .close {
		top: 1.5%;
		right: 5.5%;
	}

	.wish-result {
		width: 100vw;
		background-color: #fff;
		background-size: cover;
		background-position: center;
		position: fixed;
		top: 0;
		left: 0;
		z-index: +10;
	}

	.container {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.share {
		position: absolute;
		bottom: 5%;
		right: 10%;
	}

	.splatter {
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
	}

	.splash-art {
		height: 120%;
	}

	.merch-result {
		position: relative;
		width: min(76%, 34rem);
		height: min(76%, 34rem);
		padding: 0.35rem;
		border: 0.12rem solid rgba(255, 248, 223, 0.9);
		border-radius: 4%;
		background: rgba(255, 255, 255, 0.16);
		box-shadow: 0 1rem 3rem rgba(20, 24, 36, 0.34), 0 0 1.8rem rgba(255, 255, 255, 0.25);
		transform: translate(7%, -3%);
	}
	.merch-result img {
		display: block;
		width: 100%;
		height: 100%;
		border-radius: 3.2%;
		object-fit: cover;
	}
	:global(.mobile) .merch-result {
		width: min(62vh, 52vw);
		height: min(62vh, 52vw);
		transform: translate(8%, -2%);
	}

	.splash-art.weapon {
		height: 100%;
		width: 100%;
		position: relative;
	}
	.splash-art.weapon img {
		height: 120%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}
	.bow {
		height: 100%;
	}

	.claymore {
		height: 105% !important;
	}

	.catalyst {
		height: 45% !important;
	}

	.polearm {
		top: 65% !important;
		left: 48% !important;
		height: 130% !important;
	}

	.info,
	.starfate {
		position: fixed;
		top: 60%;
		z-index: 10;
		text-transform: capitalize;
		display: flex;
		align-items: center;
		width: 1100px;
		max-width: 95%;
	}
	.info {
		left: 50%;
		transform: translate(-50%, -50%);
	}

	:global(.mobile) .info {
		max-width: 83%;
	}

	.info i.elemen,
	.vision {
		font-size: 5.2em;
		margin-right: -7px;
		margin-top: -5px;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		position: relative;
		z-index: -2;
	}

	.vision {
		height: 5rem;
	}

	:global(.mobile) .vision {
		height: 4rem;
	}

	.name {
		position: relative;
		z-index: +2;
		width: 100%;
	}

	.name .text {
		max-width: 38%;
		font-size: 2.5em;
		line-height: 1.2em;
		color: #fff;
		-webkit-text-stroke: 0.015em #000;
	}

	:global(.zh-CN) .name .text,
	:global(.ja-JP) .name .text {
		font-size: 3.5em;
	}

	.gi-star {
		color: #f7cf33;
		font-size: 1.525em;
		display: inline-block;
	}

	.detail {
		color: #fff;
		position: fixed;
		width: 100%;
		bottom: 0;
		left: 0;
		padding: 0.5rem 1rem;
		-webkit-text-stroke: #000 0.015rem;
	}
	.detail span {
		display: block;
	}
	span.count {
		font-size: larger;
	}

	.preview .uid {
		display: unset;
	}
</style>
