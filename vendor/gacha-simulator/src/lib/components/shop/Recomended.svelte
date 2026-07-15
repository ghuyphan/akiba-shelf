<script>
	import { getContext, setContext } from 'svelte';
	import { t } from 'svelte-i18n';
	import { fade, fly } from 'svelte/transition';

	import { assets, genesis, priceList, primogem } from '$lib/store/stores';
	import { localBalance, localWelkin } from '$lib/store/localstore';
	import { playSfx } from '$lib/helpers/audio/audio.svelte';

	import TopNavParent from './parts/_top-nav-parent.svelte';
	import TopNavItem from './parts/_top-nav-item.svelte';
	import Icon from '../utility/Icon.svelte';
	import ButtonModal from '../utility/ButtonModal.svelte';
	import WelkinModal from './WelkinModal.svelte';
	import ColumnParent from './parts/_column-parent.svelte';

	let activeItem = 'welkin';
	let contentWidth;

	const handleRecomendClick = ({ detail }) => {
		if (activeItem === detail.selected) return;
		playSfx('shopsubnav');
		activeItem = detail.selected;
	};

	const showObtained = getContext('handleObtained');

	const { remaining } = localWelkin.getData();
	let dayRemaining = remaining || 0;
	let showWelkinModal = false;

	$: welkinPrice = $priceList.welkin;

	const buyWelkin = () => {
		showWelkinModal = false;
		genesis.update((n) => {
			const newQty = n + 32000;
			localBalance.set('genesis', newQty);
			return newQty;
		});
		primogem.update((n) => {
			const newQty = n + 8000;
			localBalance.set('primogem', newQty);
			return newQty;
		});
		showObtained('genesis', 32000);
		localWelkin.checkin('welkin');
		dayRemaining = localWelkin.getData().remaining;
	};

	const cancelBuy = () => (showWelkinModal = false);
	setContext('buyWelkin', buyWelkin);
	setContext('cancelBuy', cancelBuy);
</script>

<TopNavParent>
	<TopNavItem on:click={handleRecomendClick} name="welkin" active={activeItem === 'welkin'}>
		{$t('shop.recomended.welkin')}
	</TopNavItem>
</TopNavParent>

<WelkinModal show={showWelkinModal} />

<ColumnParent>
	<div
		class="content-item"
		bind:clientHeight={contentWidth}
		style="--content-width: {contentWidth}px"
	>
		<div class="card welkin" in:fade={{ duration: 400 }}>
				<img src={$assets['welkin-card.webp']} alt="Welkin of the Blessing Moon" />
				<div class="welkin-item">
					<img src={$assets['welkin.webp']} alt="Welkin Item" in:fly={{ y: -50, duration: 400 }} />
				</div>

				<h1>{$t('shop.recomended.welkin')}</h1>
				{#if dayRemaining > 0}
					<div class="remaining">
						{@html $t('shop.recomended.dayRemaining', {
							values: { days: `<strong>${dayRemaining}</strong>` }
						})}
						<span>({$t('shop.recomended.alreadyClaimed')})</span>
					</div>
				{/if}

				<h2 class="price">{welkinPrice}</h2>
				<div class="note">{$t('shop.welkinNote')}</div>

				<div class="frame">
					<div class="parent-amount">
						<span>{$t('shop.recomended.instantlyGet')}</span>
						<span class="amount">
							32000
							<Icon type="genesis" style="margin-bottom:-5%; width: 20%" />
						</span>
					</div>
					<div class="parent-amount">
						<span>{$t('shop.recomended.dailyGift')}</span>
						<span class="amount">
							8000
							<Icon type="primogem" style="margin-bottom:-5%; width: 20%" />
						</span>
					</div>

					<!-- Button -->
					<div class="purchase-button">
						<div class="caption card-stroke">
							{@html $t('shop.recomended.obtainTotal', {
								values: {
									totalGenesis: '<strong>32000</strong>',
									totalPrimo: '<strong> 240000</strong>'
								}
							})}
						</div>
						<ButtonModal
							text={$t('shop.purchaseButton')}
							type="confirm"
							on:click={() => {
								showWelkinModal = true;
								playSfx();
							}}
						/>
					</div>
				</div>
		</div>
	</div>
</ColumnParent>

<style>
	.content-item,
	.card,
	img {
		display: block;
		width: 100%;
	}

	:global(.mobile) .content-item,
	:global(.mobile) .card {
		max-width: 100%;
		width: fit-content;
		height: 75vh;
		max-height: 40vw;
	}

	.card {
		position: relative;
		background-color: #f7f3eb;
		max-width: 55rem;
		max-height: 75vh;
		aspect-ratio: 1000/561;
		border-radius: 1rem;
		overflow: hidden;
		font-size: calc(0.035 * var(--content-width));
	}

	.welkin-item {
		position: absolute;
		top: 8%;
		left: 8%;
		width: 47.5%;
		animation: welkinItem 2s infinite alternate ease-in-out;
	}

	@keyframes welkinItem {
		0% {
			transform: translateY(0);
		}
		100% {
			transform: translateY(-3%);
		}
	}

	.welkin h1 {
		position: absolute;
		right: 2%;
		top: 7.5%;
		color: #4c505e;
		font-size: calc(0.065 * var(--content-width));
	}

	.welkin h2 {
		position: absolute;
		left: 2%;
		bottom: 8%;
		font-size: calc(0.115 * var(--content-width));
		color: #fff;
	}

	.note {
		position: absolute;
		left: 6%;
		bottom: 3.7%;
		color: #fff;
		font-size: calc(0.026 * var(--content-width));
	}

	.remaining {
		width: 35%;
		position: absolute;
		top: 2%;
		left: 2%;
		color: #b3c4e3;
		font-size: calc(0.03 * var(--content-width));
	}
	.remaining span {
		color: #ffc107;
	}

	.frame {
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-top: 10%;
		z-index: +3;
		padding-right: calc(0.05 * var(--content-width));
	}

	.parent-amount {
		margin: 2% 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
	}
	.parent-amount span {
		display: block;
		text-align: right;
	}
	.parent-amount span:not(.amount),
	.purchase-button {
		color: #787b84;
	}
	.amount {
		padding: 5% 8%;
		background-color: #8e9cc0;
		color: #fff;
		border-radius: 2rem;
		margin-top: 5%;
		border: 0.1rem solid #fff;
		outline: 0.135rem solid #8e9cc0;
		width: calc(0.3 * var(--content-width));
	}

	.purchase-button {
		width: 48%;
		text-align: right;
		margin-top: auto;
		margin-bottom: 2.5%;
	}
	.purchase-button .caption {
		font-size: calc(0.029 * var(--content-width));
	}
	.card-stroke {
		line-height: 150%;
		margin-bottom: 5%;
	}

	.price {
		position: relative;
		color: #fff;
		margin-top: 5%;
		filter: drop-shadow(0 0 25px #787b84);
	}
</style>
