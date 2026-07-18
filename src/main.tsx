import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import "./styles/legacy.css";
import { resetDocumentBranding } from "./lib/branding";
import { hydrateInitialPageTheme } from "./lib/theme";
import { restoreRedirect } from "./lib/authUrls";

restoreRedirect();
hydrateInitialPageTheme();
resetDocumentBranding();

// Route-aware page chunk prefetching
const pathname = window.location.pathname;
const base = import.meta.env.BASE_URL.replace(/\/$/, "");
const appRelativePath = base && pathname.startsWith(`${base}/`)
  ? pathname.slice(base.length)
  : pathname;

if (appRelativePath.startsWith("/s/")) {
  void import("./pages/CatalogPage").catch(() => {});
} else if (appRelativePath === "/admin") {
  void import("./pages/AdminPage").catch(() => {});
} else if (appRelativePath === "/dashboard") {
  void import("./pages/DashboardPage").catch(() => {});
} else if (appRelativePath === "/auth") {
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
  .catch(() => {
    if (!sessionStorage.getItem(appChunkRetryKey)) {
      sessionStorage.setItem(appChunkRetryKey, "1");
      window.location.reload();
    } else {
      sessionStorage.removeItem(appChunkRetryKey);
      document.body.textContent =
        "Failed to load the application. Please refresh the page.";
    }
  });
