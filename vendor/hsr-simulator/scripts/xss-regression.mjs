import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import * as compiler from 'svelte/compiler';
import * as server from 'svelte/internal/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const componentPath = resolve(root, 'src/lib/components/HighlightedText.svelte');
const helperPath = resolve(root, 'src/lib/helpers/highlighted-text.js');
const descriptionPath = 'src/routes/_gachainfo/_details/_description.svelte';
const descriptionSource = await readFile(resolve(root, descriptionPath), 'utf8');
const eventBranchStart = descriptionSource.indexOf('{#if isEventWarp}');
const eventBranchEnd = descriptionSource.indexOf('{:else}', eventBranchStart);
assert.ok(eventBranchStart >= 0 && eventBranchEnd > eventBranchStart);
assert.ok(
	!descriptionSource.slice(eventBranchStart, eventBranchEnd).includes('{@html'),
	`${descriptionPath} must not render event banner data through {@html}`
);

for (const path of [
	'src/routes/_phonograph/_controller.svelte',
	'src/routes/_phonograph/_modal-track.svelte'
]) {
	const source = await readFile(resolve(root, path), 'utf8');
	assert.ok(!source.includes('{@html'), `${path} must not render persisted text through {@html}`);
}

const helperSource = (await readFile(helperPath, 'utf8')).replace('export const', 'const');
const componentSource = (await readFile(componentPath, 'utf8')).replace(
	"import { splitHighlightedText } from '$lib/helpers/highlighted-text';",
	helperSource
);
const { js } = compiler.compile(componentSource, {
	filename: componentPath,
	generate: 'server'
});
const executable = js.code
	.replace("import * as $ from 'svelte/internal/server';", '')
	.replace(/export default function \w+/, 'return function component');
const component = new Function('$', executable)(server);

const payload = '<svg/onload=globalThis.__xss=1>';
let html = '';
component(
	{
		push: (chunk) => (html += chunk),
		component: (render) => render({ push: (chunk) => (html += chunk) })
	},
	{ text: `<span>${payload}</span> has started` }
);
const document = new JSDOM(`<main>${html}</main>`).window.document;

assert.equal(document.querySelector('svg'), null);
assert.equal(document.querySelector('span').textContent, payload);
assert.equal(document.querySelector('main').textContent, `${payload} has started`);
console.log('HSR simulator XSS regression check passed.');
