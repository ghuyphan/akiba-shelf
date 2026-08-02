import assert from 'node:assert/strict';
import test from 'node:test';
import { createLazySfxPool } from './lazy-sfx-pool.js';

function setup({ muted = false, storedVolume = 0.5 } = {}) {
	const created = [];
	const calls = [];
	let savedVolume = null;
	let volumeReads = 0;
	const pool = createLazySfxPool({
		names: ['click', 'close'],
		isMuted: () => muted,
		readVolume: () => {
			volumeReads += 1;
			return storedVolume;
		},
		writeVolume: (value) => {
			savedVolume = value;
		},
		createSound: (name, volume) => {
			created.push({ name, volume });
			return {
				play: () => calls.push(`play:${name}`),
				stop: () => calls.push(`stop:${name}`),
				volume: (value) => calls.push(`volume:${name}:${value}`)
			};
		}
	});
	return {
		pool,
		created,
		calls,
		getSavedVolume: () => savedVolume,
		getVolumeReads: () => volumeReads
	};
}

test('creates no sounds until an unmuted effect is played', () => {
	const active = setup();
	assert.deepEqual(active.created, []);
	assert.equal(active.getVolumeReads(), 0);

	active.pool.play('click');
	active.pool.play('click');
	assert.deepEqual(active.created, [{ name: 'click', volume: 0.5 }]);
	assert.equal(active.getVolumeReads(), 1);
	assert.deepEqual(active.calls, ['play:click', 'play:click']);

	const muted = setup({ muted: true });
	muted.pool.play('click');
	assert.deepEqual(muted.created, []);
});

test('updates loaded sounds and applies the saved volume to future sounds', () => {
	const state = setup();
	state.pool.play('click');
	state.pool.setVolume(25);
	state.pool.play('close');

	assert.equal(state.getSavedVolume(), 0.25);
	assert.deepEqual(state.created, [
		{ name: 'click', volume: 0.5 },
		{ name: 'close', volume: 0.25 }
	]);
	assert.ok(state.calls.includes('volume:click:0.25'));
});
