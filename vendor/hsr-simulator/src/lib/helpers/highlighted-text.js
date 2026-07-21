export const splitHighlightedText = (value = '') => {
	let highlighted = false;
	const parts = [];

	for (const token of String(value).split(/(<\s*\/?\s*span\s*>)/gi)) {
		if (/^<\s*span\s*>$/i.test(token)) {
			highlighted = true;
			continue;
		}
		if (/^<\s*\/\s*span\s*>$/i.test(token)) {
			highlighted = false;
			continue;
		}
		if (token) parts.push({ text: token, highlighted });
	}

	return parts;
};
