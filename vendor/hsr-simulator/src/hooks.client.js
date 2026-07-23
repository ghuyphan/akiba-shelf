export const handleError = ({ message }) => ({
	message,
	errorId: crypto.randomUUID()
});
