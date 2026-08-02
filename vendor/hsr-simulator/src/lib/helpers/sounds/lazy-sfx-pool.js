function normalizeVolume(value) {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : 1;
}

export function createLazySfxPool({
	names,
	createSound,
	isMuted,
	readVolume,
	writeVolume,
	reportError = console.error
}) {
	const supportedNames = new Set(names);
	const sounds = new Map();
	let volume;

	function currentVolume() {
		if (volume === undefined) volume = normalizeVolume(readVolume());
		return volume;
	}

	function getSound(name) {
		if (!supportedNames.has(name)) throw new Error(`No sound effect for ${name}`);
		if (!sounds.has(name)) sounds.set(name, createSound(name, currentVolume()));
		return sounds.get(name);
	}

	function run(action, name) {
		try {
			action(getSound(name));
		} catch (error) {
			reportError(error);
		}
	}

	return {
		play(name = 'click') {
			if (isMuted()) return;
			run((sound) => sound.play(), name);
		},
		stop(name = 'click') {
			if (isMuted() || !sounds.has(name)) return;
			run((sound) => sound.stop(), name);
		},
		setVolume(percent) {
			volume = normalizeVolume(Number(percent) / 100);
			writeVolume(volume);
			for (const sound of sounds.values()) sound.volume(volume);
		}
	};
}
