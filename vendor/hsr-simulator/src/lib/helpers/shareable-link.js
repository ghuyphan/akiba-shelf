import { base } from '$app/paths';

const encodeBase64 = (value) => {
	const bytes = new TextEncoder().encode(value);
	return window.btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
};

const decodeBase64 = (value) => {
	const bytes = Uint8Array.from(window.atob(value), (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
};

const encodeAndMakeLink = (string, path = 'item') => {
	const encoded = encodeBase64(string);
	const url = new URL(`${base}/screen/${path}`, window.location.origin);
	url.searchParams.set('a', encoded);
	const shop = new URLSearchParams(window.location.search).get('shop');
	if (shop) url.searchParams.set('shop', shop);
	return url.toString();
};

export const decodeAndReadData = {
	_read(decoded) {
		let [name, eidolon, undyingType, undyingQty, type, isNew, itemID] = decoded.split(',');
		eidolon = !!parseInt(eidolon);
		undyingQty = parseInt(undyingQty);
		isNew = !!parseInt(isNew);
		return { name, eidolon, undyingType, undyingQty, type, isNew, itemID };
	},

	single(encoded) {
		const decoded = decodeBase64(encoded);
		return this._read(decoded);
	},

	multi(encoded) {
		const decoded = decodeBase64(encoded);
		const arrData = decoded.split('|');
		const readData = arrData.map(this._read);
		return readData;
	}
};

const encodeData = {
	_createStringData(data) {
		const { name, eidolon, undyingType, undyingQty, type, isNew, itemID } = data;
		const string = `${name},${+!!eidolon},${undyingType},${undyingQty},${type},${+!!isNew},${itemID || ''}`;
		return string;
	},

	single(data) {
		const stringData = this._createStringData(data[0]);
		return encodeAndMakeLink(stringData);
	},

	multi(data) {
		const arrayDataStr = data.map(this._createStringData);
		const stringData = arrayDataStr.join('|');
		return encodeAndMakeLink(stringData, 'warplist');
	}
};

export const createLink = (data = []) => {
	if (data.length > 1) return encodeData.multi(data);
	return encodeData.single(data);
};
