let screenLock;

const wakelockHandle = async ({ release = false } = {}) => {
	try {
		if (!release) {
			screenLock = await navigator.wakeLock.request('screen');
			return;
		}

		await screenLock?.release();
		screenLock = null;
	} catch (e) {
		// console.log('error');
	}
};

const requestWakeLock = () => wakelockHandle();
const releaseWakeLock = () => wakelockHandle({ release: true });

export const disposeWakeLock = () => {
	window.removeEventListener('focus', requestWakeLock);
	window.removeEventListener('blur', releaseWakeLock);
	return releaseWakeLock();
};

export const wakeLock = () => {
	const isWakeLockSupport = 'wakeLock' in navigator;
	if (!isWakeLockSupport) return;

	disposeWakeLock();
	requestWakeLock();
	window.addEventListener('focus', requestWakeLock);
	window.addEventListener('blur', releaseWakeLock);
};
