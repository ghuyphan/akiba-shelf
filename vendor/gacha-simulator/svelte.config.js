import adapter from '@sveltejs/adapter-static';
import preprocess from 'svelte-preprocess';
import path from 'path';

const base = '/gacha-simulator';
const outputDir = process.env.GACHA_OUTPUT_DIR || '../../dist/gacha-simulator';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		appDir: 'internal',
		paths: { base },
		adapter: adapter({
			pages: outputDir,
			assets: outputDir,
			fallback: 'index.html',
			precompress: false
		}),
		alias: {
			$post: path.resolve('./src/post')
		}
	},
	preprocess: preprocess({
		postcss: true,
		replace: [[/\/(videos|images|sfx|fonts)\//g, `${base}/$1/`]]
	})
};

export default config;
