<script>
	import { isMobile, isMobileLandscape, liteMode, viewportWidth } from '$lib/stores/app-store';

	export let blank = false;
	export let group = false;
	$: mobile = $isMobileLandscape || $isMobile || $viewportWidth < 700;
</script>

<div class="container" class:lite={$liteMode} class:group>
	{#if blank && !group}
		<slot />
	{:else}
		{#if !group}
			<div class="info-border"></div>
		{/if}

		<div class="info">
			<div class="wrapper-info" class:mobile></div>
		</div>
		<div class="featured">
			<slot />
		</div>
	{/if}

</div>

<style>
	.container {
		width: 100%;
		height: 100%;
		display: flex;
		position: relative;
	}

	.info {
		width: 30%;
		height: 100%;
		position: relative;
	}
	.group .info {
		width: 25%;
	}

	.info-border {
		width: calc(0.009 * var(--bw));
		height: 100%;
		position: absolute;
		z-index: -1;
		top: 0;
		left: calc(30% - calc(0.009 * var(--bw)));
		background-image: linear-gradient(black 80%, transparent);
	}

	.lite .info-border {
		background-image: unset;
		background-color: black;
	}

	.wrapper-info {
		height: 100%;
		width: 97.5%;
		background-image: linear-gradient(rgba(255, 255, 255, 0.9) 85%, transparent);
		border-top-right-radius: calc(0.05 * var(--bw));
		padding: 4.5%;
	}

	.group .wrapper-info {
		background-image: linear-gradient(rgba(51, 48, 38, 0.9), rgba(26, 26, 26, 0.9) 40%);
		width: 100%;
	}

	.wrapper-info:not(.mobile) {
		display: none;
	}

	.lite .wrapper-info {
		background-image: unset;
		background-color: rgb(240, 240, 240);
	}

	.featured {
		position: relative;
		width: 70%;
	}
	.group .featured {
		width: 75%;
	}

</style>
