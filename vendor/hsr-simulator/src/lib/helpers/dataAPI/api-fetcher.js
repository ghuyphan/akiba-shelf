export const fetchMedia = async (videoID, type = 'audio') => {
	try {
		let supabaseUrl = '';
		let supabaseAnon = '';
		if (typeof window !== 'undefined') {
			const urlParams = new URLSearchParams(window.location.search);
			supabaseUrl = urlParams.get('supabase_url') || '';
			supabaseAnon = urlParams.get('supabase_anon') || '';
		}

		if (supabaseUrl && supabaseAnon) {
			const headers = new Headers();
			headers.append('Content-Type', 'application/json');
			headers.append('Authorization', `Bearer ${supabaseAnon}`);
			headers.append('apikey', supabaseAnon);

			const data = await fetch(`${supabaseUrl}/functions/v1/gacha-music-proxy`, {
				method: 'POST',
				body: JSON.stringify({ videoID, type }),
				headers
			});

			if (data.status !== 200) return { status: 'error' };
			const result = await data.json();
			return result;
		} else {
			const dataToPost = { videoID, type };
			const headers = new Headers();
			headers.append('Content-Type', 'text/plain');

			const data = await fetch('https://api.wishsimulator.app/track', {
				method: 'POST',
				body: JSON.stringify(dataToPost),
				headers
			});

			if (data.status !== 200) return { status: 'error' };
			const result = await data.json();
			return result;
		}
	} catch (e) {
		console.error(e);
		return { status: 'error' };
	}
};


export const toBlob = async (url) => {
	try {
		if (!url) return url;
		if (/videoplayback|googlevideo/.test(url)) return url;

		const vi = await fetch(url);
		const blob = await vi.blob();
		const blobURL = URL.createObjectURL(blob);
		return blobURL;
	} catch (e) {
		return url;
	}
};
