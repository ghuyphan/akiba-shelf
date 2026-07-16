import path from 'path';
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { imagetools } from 'vite-imagetools';
import { plugin as MdPlugin } from 'vite-plugin-markdown';

export default defineConfig({
	plugins: [
		imagetools({}),
		sveltekit(),
		MdPlugin({ mode: 'html' })
	],
	resolve: {
		alias: {
			$post: path.resolve('./src/post'),
			'@images': path.resolve('./src/images')
		}
	},
	build: {
		chunkSizeWarningLimit: 500,
		reportCompressedSize: false,
		target: ['es2020']
	}
});
