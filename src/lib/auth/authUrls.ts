const unsafeTarget = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export function getAppUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function restoreRedirect(
  location: Location = window.location,
  configuredBase = import.meta.env.BASE_URL,
): boolean {
  const url = new URL(location.href);
  const target = url.searchParams.get("redirect");
  if (!target) return false;
  url.searchParams.delete("redirect");
  if (unsafeTarget.test(target) || !target.startsWith("/")) {
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return false;
  }
  const restored = new URL(target, location.origin);
  if (restored.origin !== location.origin) return false;
  const base = configuredBase.replace(/\/$/, "");
  const pathname =
    base && restored.pathname.startsWith(`${base}/`)
      ? restored.pathname
      : `${base}${restored.pathname}`;
  history.replaceState(
    null,
    "",
    `${pathname || "/"}${restored.search}${restored.hash}`,
  );
  return true;
}
