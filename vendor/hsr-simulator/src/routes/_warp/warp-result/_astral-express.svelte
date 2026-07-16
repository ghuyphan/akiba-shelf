<script>
	import { getContext, tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import { assets, viewportHeight } from '$lib/stores/app-store';
	import { playSfx, stopSfx } from '$lib/helpers/sounds/audiofx';
	import ButtonIcon from '$lib/components/ButtonIcon.svelte';

	export let show;
	export let rarity;
	export let banner;

	let expressVideo;
	let videoSrc = '';
	let playbackId = 0;
	let showSkipButton = false;

	const showSplashArt = getContext('showSplashArt');
	const onExpressArrived = ({ skip = false } = {}) => {
		playbackId++;
		videoSrc = '';
		showSplashArt({ skip });
		showSkipButton = false;
	};

	const skip = () => {
		stopSfx(`express-${rarity}star`);
		expressVideo?.pause();
		onExpressArrived({ skip: true });
	};

	const showVideoHandle = async (rarity, type) => {
		const prefix = ['starter', 'regular'].includes(type) ? 'regular' : 'event';
		const nextSrc = $assets[`${prefix}-${rarity}star.mp4`];
		if (!nextSrc) return onExpressArrived();
		const currentPlayback = ++playbackId;
		videoSrc = nextSrc;
		await tick();
		if (currentPlayback !== playbackId || !expressVideo) return;
		try {
			await expressVideo.play();
			playSfx(`express-${rarity}star`);
		} catch (error) {
			console.error('Unable to play the Astral Express animation.', error);
			onExpressArrived();
		}
	};

	$: if (show) void showVideoHandle(rarity, banner);
</script>

<div
	role="dialog"
	tabindex="0"
	class:show
	class="express"
	style="height: {$viewportHeight}px"
	on:mousedown={() => (showSkipButton = true)}
>
	<!-- Mount only the selected animation so unused warp videos remain untouched. -->
	<div class="video">
		{#if videoSrc}
			<video
				bind:this={expressVideo}
				muted
				preload="metadata"
				src={videoSrc}
				type="video/mp4"
				crossorigin="anonymous"
				on:ended={() => onExpressArrived()}
			></video>
		{/if}

		{#if showSkipButton}
			<div class="skip" in:fade={{ duration: 200 }}>
				<ButtonIcon icon="skip" on:click={skip} />
			</div>
		{/if}
	</div>
</div>

<style>
	.express {
		position: fixed;
		z-index: 990;
		display: none;
		top: 0;
		left: 0;
		width: 100vw;
	}
	.express.show {
		display: block;
	}

	.video {
		position: relative;
		width: 100vw;
		height: 100%;
	}

	video {
		display: block;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: bottom;
	}

	.skip {
		position: absolute;
		top: 0;
		right: 0;
		padding: 3.7vh 2%;
		z-index: 10;
	}

	:global(.mobileLandscape) .skip {
		padding: 1.5vh 5%;
	}
</style>
