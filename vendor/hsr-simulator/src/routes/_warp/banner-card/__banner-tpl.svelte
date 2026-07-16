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

	<svg class="banner-corner" viewBox="0 0 68909.65 94154.68">
		<g id="Layer_x0020_1">
			<path
				d="M68909.65 94154.68l0 -82480.77 0 -11673.91 -11673.85 0 -57235.8 0c0,6420.78 5253.57,11673.91 11673.91,11673.91l35926.8 0c5385.08,92.08 9635.09,2685.92 9635.09,7115.95l0 63690.91c0,6420.78 5253.07,11673.91 11673.85,11673.91z"
			/>
		</g>
	</svg>
	<div class="corner-barcode">
		<svg class="barcode-graphic" viewBox="0 0 12 120" fill="currentColor">
			<circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.2" fill="none" />
			<circle cx="6" cy="15" r="2.5" fill="currentColor" />
			<rect x="2" y="26" width="8" height="1" />
			<rect x="2" y="29" width="8" height="4" />
			<rect x="2" y="35" width="8" height="1" />
			<rect x="2" y="38" width="8" height="2" />
			<rect x="2" y="42" width="8" height="1" />
			<rect x="2" y="45" width="8" height="6" />
			<rect x="2" y="53" width="8" height="2" />
			<rect x="2" y="57" width="8" height="3" />
			<rect x="2" y="62" width="8" height="1" />
			<rect x="2" y="65" width="8" height="5" />
			<rect x="2" y="72" width="8" height="2" />
			<rect x="2" y="76" width="8" height="1" />
			<rect x="2" y="79" width="8" height="4" />
			<rect x="2" y="85" width="8" height="2" />
			<rect x="2" y="89" width="8" height="1" />
			<rect x="2" y="92" width="8" height="6" />
			<rect x="2" y="100" width="8" height="2" />
			<rect x="2" y="104" width="8" height="3" />
			<rect x="2" y="109" width="8" height="1" />
			<rect x="2" y="112" width="8" height="4" />
		</svg>
	</div>
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

	.corner-barcode {
		position: absolute;
		top: 15%;
		left: 91.4%;
		z-index: +2;
		height: 60%;
		width: 1.2%;
		opacity: 0.35;
		color: #fff;
		pointer-events: none;
	}

	.barcode-graphic {
		height: 100%;
		width: 100%;
		display: block;
	}

	.banner-corner {
		width: 12.5%;
		right: 0;
		opacity: 0.65;
		position: absolute;
		z-index: +1;
		pointer-events: none;
	}
</style>
