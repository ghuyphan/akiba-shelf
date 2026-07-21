export type RoutePrefetchTarget =
  | "catalog"
  | "admin"
  | "dashboard"
  | "auth"
  | null;

export function getRoutePrefetchTarget(
  pathname: string,
  baseUrl: string,
): RoutePrefetchTarget {
  const base = baseUrl.replace(/\/$/, "");
  const appRelativePath =
    base && pathname.startsWith(`${base}/`)
      ? pathname.slice(base.length)
      : pathname;

  if (/^\/s\/[^/]+\/?$/.test(appRelativePath)) return "catalog";
  if (appRelativePath === "/admin") return "admin";
  if (appRelativePath === "/dashboard") return "dashboard";
  if (appRelativePath === "/auth") return "auth";
  return null;
}
