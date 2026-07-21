import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { compile } from 'svelte/compiler';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const componentPath = resolve(root, 'src/lib/components/utility/HighlightedBannerName.svelte');
const riskyPaths = [
	'src/lib/components/gachainfo/_parts/title.svelte',
	'src/lib/components/wish/_parts/frames/_beginner-frame.svelte',
	'src/lib/components/wish/_parts/frames/_events-frame.svelte',
	'src/lib/components/wish/_parts/frames/_standard-frame.svelte',
	'src/lib/components/wish/_parts/frames/_weapons-frame.svelte'
];

for (const path of riskyPaths) {
	const source = await readFile(resolve(root, path), 'utf8');
	assert.ok(!source.includes('{@html'), `${path} must not render banner names through {@html}`);
}

const source = await readFile(componentPath, 'utf8');
const { js } = compile(source, { filename: componentPath, generate: 'ssr', format: 'cjs' });
const require = createRequire(import.meta.url);
const module = { exports: {} };
new Function('module', 'exports', 'require', js.code)(module, module.exports, require);

const payload = '<svg/onload=globalThis.__xss=1>';
const { html } = module.exports.default.render({
	name: payload,
	highlightClass: 'anemo-flat'
});
const document = new JSDOM(`<main>${html}</main>`).window.document;

assert.equal(document.querySelector('svg'), null);
assert.equal(document.querySelector('main').textContent, payload);
assert.equal(document.querySelector('span').textContent, payload);
console.log('Genshin simulator XSS regression check passed.');
