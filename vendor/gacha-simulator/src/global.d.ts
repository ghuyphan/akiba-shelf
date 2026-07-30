/// <reference types="@sveltejs/kit" />

declare module 'file-saver' {
	export function saveAs(data: Blob | string, filename?: string): void;
}

declare module 'howler' {
	export class Howl {
		constructor(options: { src: string[]; loop?: boolean });
		pause(): void;
		play(): void;
		stop(): void;
	}
}

declare module 'overlayscrollbars' {
	type OverlayScrollbarsOptions = {
		className?: string;
		sizeAutoCapable?: boolean;
		scrollbars?: { visibility?: string };
	};

	export default function OverlayScrollbars(
		element: Element,
		options?: OverlayScrollbarsOptions
	): unknown;
}
