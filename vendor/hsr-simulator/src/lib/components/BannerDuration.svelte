<script>
	import { onMount } from 'svelte';
	import { t } from 'svelte-i18n';

	export let endsAt = null;

	let now = Date.now();

	onMount(() => {
		const timer = window.setInterval(() => {
			now = Date.now();
		}, 60_000);
		return () => window.clearInterval(timer);
	});

	$: endTime = endsAt ? Date.parse(endsAt) : Number.NaN;
	$: remaining = Number.isFinite(endTime) ? Math.max(0, endTime - now) : null;
	$: days = remaining === null ? null : Math.floor(remaining / 86_400_000);
	$: hours = remaining === null ? null : Math.floor((remaining % 86_400_000) / 3_600_000);
	$: label = remaining === null
		? $t('warp.duration')
		: $t('warp.duration').replace('∞', String(days)).replace('∞', String(hours));
</script>

<span class="duration-caption">{label}</span>
