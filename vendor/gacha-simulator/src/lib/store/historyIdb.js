import { browser } from '$app/environment';
import { openDB } from 'idb';
import { createMemoryHistoryStore } from './memoryHistory';

const version = 1;
const DBName = 'WishSimulator';
const storeName = 'history';

let IndexedDB;
if (browser) {
	IndexedDB = openDB(DBName, version, {
		upgrade(db) {
			const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
			store.createIndex('banner', 'banner', { unique: false });
			store.createIndex('name', 'name', { unique: false });
		}
	});
}

const memoryHistory = createMemoryHistoryStore();

const HistoryIDB = {
	async historyCount() {
		try {
			return (await IndexedDB).count(storeName);
		} catch (e) {
			return memoryHistory.count();
		}
	},
	async getList(banner) {
		try {
			return (await IndexedDB).getAllFromIndex(storeName, 'banner', banner);
		} catch (e) {
			return memoryHistory.getByBanner(banner);
		}
	},

	async countItem(name) {
		try {
			return (await IndexedDB).countFromIndex(storeName, 'name', name);
		} catch (e) {
			return memoryHistory.countByName(name);
		}
	},

	async getByName(name) {
		try {
			return (await IndexedDB).getAllFromIndex(storeName, 'name', name);
		} catch (e) {
			return memoryHistory.getByName(name);
		}
	},

	async resetHistory(banner) {
		try {
			const idb = await IndexedDB;
			const keys = await idb.getAllKeysFromIndex(storeName, 'banner', banner);
			await Promise.all(keys.map((key) => idb.delete(storeName, key)));
			return 'success';
		} catch (e) {
			memoryHistory.resetBanner(banner);
			return 'success';
		}
	},
	async clearIDB() {
		try {
			return (await IndexedDB).clear(storeName);
		} catch (e) {
			memoryHistory.clear();
		}
	},
	async getAllHistories() {
		try {
			return (await IndexedDB).getAll(storeName);
		} catch (e) {
			return memoryHistory.getAll();
		}
	},
	async addHistory(data) {
		if (
			!data ||
			typeof data !== 'object' ||
			!Object.prototype.hasOwnProperty.call(data, 'banner')
		) {
			return;
		}
		try {
			return (await IndexedDB).put(storeName, data);
		} catch (e) {
			return memoryHistory.put(data);
		}
	},
	async delete(id) {
		if (!id) return;
		try {
			return (await IndexedDB).delete(storeName, id);
		} catch (e) {
			memoryHistory.delete(id);
		}
	}
};

export default HistoryIDB;
