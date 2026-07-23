import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/base/global.css";
import "./styles/legacy.css";
import { resetDocumentBranding } from "./lib/branding";
import { hydrateInitialPageTheme } from "./utils/theme";
import { restoreRedirect } from "./lib/auth/authUrls";
import { getRoutePrefetchTarget } from "./lib/routePrefetch";
import { reloadForAppUpdate } from "./utils/lazyWithRetry";
import { initObservability, reportError } from "./lib/observability";

restoreRedirect();
hydrateInitialPageTheme();
resetDocumentBranding();
initObservability();

// Route-aware page chunk prefetching
const pathname = window.location.pathname;
const prefetchTarget = getRoutePrefetchTarget(pathname, import.meta.env.BASE_URL);

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
    sessionStorage.removeItem(appChunkRetryKey);
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch(async (error: unknown) => {
    reportError(error, { stage: "app_bootstrap" });
    if (!sessionStorage.getItem(appChunkRetryKey)) {
      sessionStorage.setItem(appChunkRetryKey, "1");
      await reloadForAppUpdate();
    } else {
      sessionStorage.removeItem(appChunkRetryKey);
      document.body.textContent =
        "Failed to load the application. Please refresh the page.";
    }
  });
