const getBannerName = (banner) => {
	const split = banner.split('-');
	return { name: split.slice(0, -1).join('-'), number: split[split.length - 1] };
};

const getName = (name) => {
	if (!name) return name;
	const removedDelimiter = name.replace(/-/g, ' ').replace(new RegExp('_'), "'");
	return removedDelimiter
		.split(' ')
		.map((t) => t.charAt(0).toUpperCase() + t.slice(1))
		.join(' ');
};

const getSlug = (name) => name.replace(/ /g, '-').replace(new RegExp("'"), '_');

const copy = (text) => {
	if (!navigator.clipboard) return Promise.reject(new Error('Clipboard API is unavailable'));
	return navigator.clipboard.writeText(text);
};

export { getName, getSlug, copy, getBannerName };
