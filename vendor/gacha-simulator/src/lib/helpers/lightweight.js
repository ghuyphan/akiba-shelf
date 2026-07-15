/**
 * Check if the application should run in lightweight mode
 * (due to 2G connection, data-saver enabled, or explicit lightweight query parameter).
 * @returns {boolean}
 */
export function checkLightweight() {
	if (typeof navigator !== 'undefined') {
		const conn = navigator.connection;
		if (conn && (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
			return true;
		}
	}
	if (typeof window !== 'undefined') {
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('lightweight') === '1') {
			return true;
		}
	}
	return false;
}
