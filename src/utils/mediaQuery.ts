export type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

// Older Safari exposes only the deprecated addListener API.
export function subscribeToMediaQuery(
  media: MediaQueryList,
  listener: MediaQueryChangeListener,
) {
  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }

  media.addListener(listener);
  return () => media.removeListener(listener);
}
