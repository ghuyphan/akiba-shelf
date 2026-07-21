<script>
	import { splitHighlightedText } from '$lib/helpers/highlighted-text';

	export let text = '';

	$: parts = splitHighlightedText(text);
</script>

{#each parts as part}
	{#if part.highlighted}<span>{part.text}</span>{:else}{part.text}{/if}
{/each}
