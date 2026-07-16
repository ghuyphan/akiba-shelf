import path from 'path';
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const base = '/hsr-simulator';
const outputDir = process.env.GACHA_OUTPUT_DIR || '../../dist/hsr-simulator';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		appDir: 'internal',
		paths: { base, relative: false },
		version: {
			name: 'matsuri'
		},
		prerender: {
			handleHttpError: 'warn',
			handleUnseenRoutes: 'warn'
		},
		adapter: adapter({
			pages: outputDir,
			assets: outputDir,
			fallback: 'index.html',
			precompress: false
		}),
		alias: {
			'@image': path.resolve('./src/post')
		}
	}
};

export default config;
