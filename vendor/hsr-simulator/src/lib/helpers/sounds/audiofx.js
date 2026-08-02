import { Howl } from 'howler';
import { base } from '$app/paths';
import { localConfig } from '$lib/helpers/dataAPI/api-localstorage';
import { cookie } from '$lib/helpers/dataAPI/api-cookie';
import { browser } from '$app/environment';
import { createLazySfxPool } from './lazy-sfx-pool.js';

const sfxList = [
	'balance-click',
	'camera',
	'click',
	'click2',
	'close',
	'collection-close',
	'collection-open',
	'express-3star',
	'express-4star',
	'express-5star',
	'item-obtained',
	'modal-close',
	'paper-flip',
	'reveal-3star',
	'reveal-4star',
	'reveal-5star',
	'setting-click',
	'setting-close',
	'setting-loaded',
	'setting-item',
	'setting-item-option',
	'shop-item-select',
	'shop-open',
	'switch-banner',
	'sidebar-click',
	'warpresult-close',
	'warpresult-list-4',
	'warpresult-list-5'
];

const isMuted = () => {
	let sounds = localConfig.get('mutedSounds');
	const { sfx = false } = typeof sounds === 'object' ? sounds : {};
	return sfx;
};

const sfxPool = createLazySfxPool({
	names: sfxList,
	isMuted,
	readVolume: () => (browser ? cookie.get('sfxVolume') : 1),
	writeVolume: (volume) => cookie.set('sfxVolume', volume),
	createSound: (name, volume) =>
		new Howl({
			src: [`${base}/audiofx/${name}.ogg`],
			preload: false,
			volume,
			onplayerror: (_soundId, error) => {
				console.warn(`Unable to play HSR sound effect "${name}".`, error);
			},
			onloaderror: (_soundId, error) => {
				console.warn(`Unable to load HSR sound effect "${name}".`, error);
			}
		}),
	reportError: (error) => console.error('Unable to use HSR sound effect:', error.message)
});

export const playSfx = (nameOfSoundfx = 'click') => sfxPool.play(nameOfSoundfx);
export const stopSfx = (nameOfSoundfx = 'click') => sfxPool.stop(nameOfSoundfx);
export const setSfxVolume = (value) => sfxPool.setVolume(value);
