let screenLock;

const requestScreenLock = async () => {
	try {
		if (!screenLock) screenLock = await navigator.wakeLock.request('screen');
	} catch {
		screenLock = null;
	}
};

const releaseScreenLock = async () => {
	try {
		await screenLock?.release();
	} catch {
		// The browser may already have released it while the tab was hidden.
	} finally {
		screenLock = null;
	}
};

export const disposeWakeLock = () => {
	window.removeEventListener('focus', requestScreenLock);
	window.removeEventListener('blur', releaseScreenLock);
	return releaseScreenLock();
};

export const wakeLock = async () => {
	if (!('wakeLock' in navigator)) return;
	await disposeWakeLock();
	await requestScreenLock();
	window.addEventListener('focus', requestScreenLock);
	window.addEventListener('blur', releaseScreenLock);
};
