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

void import("./App").then(({ App }) => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
