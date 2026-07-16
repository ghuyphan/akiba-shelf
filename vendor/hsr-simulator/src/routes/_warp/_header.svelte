<script>
	import { getContext } from 'svelte';
	import { t } from 'svelte-i18n';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { regularPass, specialPass, stellarJade, warpAmount } from '$lib/stores/app-store';

	import Header from '$lib/components/Header.svelte';
	import MyFund from '$lib/components/MyFund.svelte';
	import ButtonIcon from '$lib/components/ButtonIcon.svelte';

	export let bannerType = '';
	export let bannerName = '';
	export let isMerch = false;

	$: event = bannerType.match('event');
	$: balance = event ? $specialPass : $regularPass;
	$: unlimitedWarp = $warpAmount === 'unlimited';
	$: heading = bannerName
		? isMerch
			? bannerName
			: $t(`banner.${bannerName}`, { default: bannerName })
		: 'Subject To Change';

	const closeSimulator = () => {
		playSfx('close');
		window.parent.postMessage({ type: 'matsuri-gacha-close' }, window.location.origin);
	};
</script>

<Header icon="warp" h1={$t('warp.heading')} h2={heading} hideDesktopIcon>
	<div class="budget">
		<MyFund type={event ? 'specialPass' : 'regularPass'}>
			{unlimitedWarp ? '∞' : balance}
		</MyFund>
		<MyFund type="stellarJade" plusbutton>
			{unlimitedWarp ? '∞' : $stellarJade}
		</MyFund>
	</div>
	<div class="close">
		<ButtonIcon on:click={closeSimulator} />
	</div>
</Header>
