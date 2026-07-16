<div class="banner-chrome" aria-hidden="true">
	<svg class="banner-corner" viewBox="0 0 68909.65 94154.68">
		<path
			d="M68909.65 94154.68l0 -82480.77 0 -11673.91 -11673.85 0 -57235.8 0c0,6420.78 5253.57,11673.91 11673.91,11673.91l35926.8 0c5385.08,92.08 9635.09,2685.92 9635.09,7115.95l0 63690.91c0,6420.78 5253.07,11673.91 11673.85,11673.91z"
		/>
	</svg>
	<div class="corner-barcode">
		<svg viewBox="0 0 120 12" fill="currentColor" preserveAspectRatio="xMidYMid meet">
			<circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.2" fill="none" />
			<circle cx="15" cy="6" r="2.5" />
			<rect x="26" y="2" width="1" height="8" />
			<rect x="29" y="2" width="4" height="8" />
			<rect x="35" y="2" width="1" height="8" />
			<rect x="38" y="2" width="2" height="8" />
			<rect x="42" y="2" width="1" height="8" />
			<rect x="45" y="2" width="6" height="8" />
			<rect x="53" y="2" width="2" height="8" />
			<rect x="57" y="2" width="3" height="8" />
			<rect x="62" y="2" width="1" height="8" />
			<rect x="65" y="2" width="5" height="8" />
			<rect x="72" y="2" width="2" height="8" />
			<rect x="76" y="2" width="1" height="8" />
			<rect x="79" y="2" width="4" height="8" />
			<rect x="85" y="2" width="2" height="8" />
			<rect x="89" y="2" width="1" height="8" />
			<rect x="92" y="2" width="6" height="8" />
			<rect x="100" y="2" width="2" height="8" />
			<rect x="104" y="2" width="3" height="8" />
			<rect x="109" y="2" width="1" height="8" />
			<rect x="112" y="2" width="4" height="8" />
		</svg>
	</div>
</div>

<style>
	.banner-chrome {
		position: absolute;
		inset: 0;
		z-index: 3;
		pointer-events: none;
	}

	.banner-corner {
		position: absolute;
		top: 0;
		right: 0;
		width: 12.5%;
		opacity: 0.65;
	}

	.corner-barcode {
		position: absolute;
		bottom: 86%;
		left: 91.4%;
		z-index: 2;
		width: 13%;
		transform: rotate(90deg);
		color: #fff;
		opacity: 0.4;
	}

	.corner-barcode svg {
		display: block;
		width: 100%;
		height: calc(0.014 * var(--bw));
	}
</style>
