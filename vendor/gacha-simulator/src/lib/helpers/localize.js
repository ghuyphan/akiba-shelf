export const parseLocalizedText = (text, currentLocale = 'en-US') => {
	if (!text) return '';
	
	const tagRegex = /\[([a-z]{2}(?:-[a-z]{2})?)\]/gi;
	if (!tagRegex.test(text)) {
		if (text.includes('|')) {
			const parts = text.split('|').map(p => p.trim());
			if (currentLocale && currentLocale.startsWith('vi')) {
				return parts[1] || parts[0];
			}
			return parts[0];
		}
		return text;
	}

	const sections = {};
	const parts = text.split(tagRegex);
	
	for (let i = 1; i < parts.length; i += 2) {
		const lang = parts[i].toLowerCase();
		const val = parts[i + 1] ? parts[i + 1].trim() : '';
		sections[lang] = val;
	}

	const exactLocale = (currentLocale || 'en-US').toLowerCase();
	if (sections[exactLocale]) return sections[exactLocale];

	const prefixLocale = exactLocale.split('-')[0];
	if (sections[prefixLocale]) return sections[prefixLocale];

	if (sections['en-us']) return sections['en-us'];
	if (sections['en']) return sections['en'];
	
	const firstLang = Object.keys(sections)[0];
	if (firstLang) return sections[firstLang];

	return text;
};
