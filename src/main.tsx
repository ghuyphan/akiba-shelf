import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/base/fonts.css";
import "./styles/base/global.css";
import "./styles/legacy.css";
import { resetDocumentBranding } from "./lib/branding";
import { restoreRedirect } from "./lib/auth/authUrls";
import { getRoutePrefetchTarget } from "./lib/routePrefetch";
import { reloadForAppUpdate } from "./utils/lazyWithRetry";
import { initObservability, reportError } from "./lib/observability";
import { prefetchStorefrontBootstrapFromPath } from "./lib/api/storefrontBootstrapRequest";
import {
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
} from "./lib/offline/safeStorage";

restoreRedirect();
resetDocumentBranding();
initObservability();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const appPathname = window.location.pathname.startsWith(basePath)
  ? window.location.pathname.slice(basePath.length) || "/"
  : window.location.pathname;
const storefrontTheme = appPathname.match(/^\/s\/([^/?#]+)/);
let initialThemeScope: string | undefined;
try {
  const adminShopId =
    appPathname === "/admin"
      ? localStorage.getItem("akiba-active-shop")?.trim()
      : undefined;
  initialThemeScope = storefrontTheme
    ? `slug:${decodeURIComponent(storefrontTheme[1])}`
    : adminShopId
      ? `id:${adminShopId}`
      : undefined;
} catch {
  // Theme hydration is optional when storage or route decoding is unavailable.
}
let hasStoredTheme = false;
try {
  hasStoredTheme = Boolean(
    initialThemeScope &&
      localStorage.getItem(`merch-booth-theme:${initialThemeScope}`),
  );
} catch {
  // Continue with platform defaults when browser storage is unavailable.
}
if (hasStoredTheme) {
  void import("./utils/themeStorage").then(({ hydrateInitialPageTheme }) =>
    hydrateInitialPageTheme(),
  );
}

// Route-aware page chunk prefetching
const pathname = window.location.pathname;
prefetchStorefrontBootstrapFromPath(pathname, import.meta.env.BASE_URL);
const prefetchTarget = getRoutePrefetchTarget(
  pathname,
  import.meta.env.BASE_URL,
);

if (prefetchTarget === "catalog") {
  void import("./pages/CatalogPage").catch(() => {});
} else if (prefetchTarget === "admin") {
  void import("./pages/AdminPage").catch(() => {});
} else if (prefetchTarget === "dashboard") {
  void import("./pages/DashboardPage").catch(() => {});
} else if (prefetchTarget === "auth") {
  void import("./pages/AuthPage").catch(() => {});
}

const appChunkRetryKey = "chunk-reload:app";
void import("./App")
  .then(({ App }) => {
    safeSessionStorageRemove(appChunkRetryKey);
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch(async (error: unknown) => {
    reportError(error, { stage: "app_bootstrap" });
    if (!safeSessionStorageGet(appChunkRetryKey)) {
      safeSessionStorageSet(appChunkRetryKey, "1");
      await reloadForAppUpdate();
    } else {
      safeSessionStorageRemove(appChunkRetryKey);
      document.body.textContent =
        "Failed to load the application. Please refresh the page.";
    }
  });
