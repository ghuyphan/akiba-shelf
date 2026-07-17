<script>
	import { assets } from '$lib/stores/app-store';

	export let type = '';
	export let style = '';

	$: pic = {
		regularPass: $assets['regular-pass.webp'],
		specialPass: $assets['special-pass.webp'],
		eidolon3: $assets['eidolon-4star.webp'],
		eidolon4: $assets['eidolon-4star.webp'],
		eidolon5: $assets['eidolon-5star.webp'],
		embers: $assets['undying-embers.webp'],
		starlight: $assets['undying-starlight.webp'],
		oneiric: $assets['oneiric-shard.webp'],
		stellarJade: $assets['stellar-jade.webp']
	};

	$: src = pic[type] || (type.startsWith('eidolon') ? pic.eidolon4 : undefined);
</script>

<img src={src} alt={type} {style} crossorigin="anonymous" />

<style>
	img {
		width: 30px;
	}
</style>
