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

void import("./App")
  .then(({ App }) => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  })
  .catch(() => {
    const key = "chunk-reload";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      window.location.reload();
    } else {
      sessionStorage.removeItem(key);
      document.body.textContent =
        "Failed to load the application. Please refresh the page.";
    }
  });
