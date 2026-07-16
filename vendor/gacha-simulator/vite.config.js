import { sveltekit } from '@sveltejs/kit/vite';
import { plugin as MdPlugin } from 'vite-plugin-markdown';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit(), MdPlugin({ mode: 'html' })],
	build: {
		chunkSizeWarningLimit: 350,
		reportCompressedSize: false,
		target: ['es2020']
	}
};

export default config;
