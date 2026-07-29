export const createMemoryHistoryStore = () => {
	let entries = [];
	let nextId = 1;

	return {
		count: () => entries.length,
		getByBanner: (banner) =>
			entries.filter((entry) => entry.banner === banner).map((entry) => ({ ...entry })),
		countByName: (name) => entries.filter((entry) => entry.name === name).length,
		getByName: (name) =>
			entries.filter((entry) => entry.name === name).map((entry) => ({ ...entry })),
		resetBanner: (banner) => {
			entries = entries.filter((entry) => entry.banner !== banner);
		},
		clear: () => {
			entries = [];
			nextId = 1;
		},
		getAll: () => entries.map((entry) => ({ ...entry })),
		put: (data) => {
			const entry = { ...data };
			if (entry.id == null) {
				entry.id = nextId++;
			} else {
				if (typeof entry.id === 'number' && Number.isFinite(entry.id)) {
					nextId = Math.max(nextId, entry.id + 1);
				}
				entries = entries.filter((existing) => existing.id !== entry.id);
			}
			entries.push(entry);
			return entry.id;
		},
		delete: (id) => {
			entries = entries.filter((entry) => entry.id !== id);
		}
	};
};
