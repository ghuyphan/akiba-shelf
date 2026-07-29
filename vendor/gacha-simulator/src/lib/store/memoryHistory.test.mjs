import assert from 'node:assert/strict';
import test from 'node:test';
import { createMemoryHistoryStore } from './memoryHistory.js';

test('memory history mirrors the required IndexedDB operations', () => {
	const history = createMemoryHistoryStore();
	const firstId = history.put({ banner: 'character', name: 'Amber' });
	const secondId = history.put({ banner: 'weapon', name: 'Amber' });

	assert.equal(firstId, 1);
	assert.equal(secondId, 2);
	assert.equal(history.count(), 2);
	assert.equal(history.countByName('Amber'), 2);
	assert.deepEqual(
		history.getByBanner('character').map(({ id }) => id),
		[firstId]
	);

	history.delete(firstId);
	assert.equal(history.count(), 1);
	history.resetBanner('weapon');
	assert.equal(history.count(), 0);
});

test('memory history replaces explicit IDs and resets generated IDs after clear', () => {
	const history = createMemoryHistoryStore();
	history.put({ id: 10, banner: 'character', name: 'A' });
	history.put({ id: 10, banner: 'character', name: 'B' });

	assert.deepEqual(history.getAll(), [{ id: 10, banner: 'character', name: 'B' }]);
	assert.equal(history.put({ banner: 'character', name: 'C' }), 11);

	history.clear();
	assert.equal(history.count(), 0);
	assert.equal(history.put({ banner: 'character', name: 'D' }), 1);
});
