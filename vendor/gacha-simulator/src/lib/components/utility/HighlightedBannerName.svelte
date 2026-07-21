<script>
	export let name = '';
	export let highlightClass = '';
	export let highlight = 'first';

	$: words = String(name).trim().split(/\s+/).filter(Boolean);
	$: first = words[0] || '';
	$: rest = words.slice(1).join(' ');
</script>

{#if highlight === 'rest'}
	{first}{#if rest} <span class={highlightClass}>{rest}</span>{/if}
{:else}
	{#if first}<span class={highlightClass}>{first}</span>{/if}{#if rest} {rest}{/if}
{/if}
