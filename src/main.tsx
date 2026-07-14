import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import "./styles/legacy.css";
import { App } from "./App";
import { resetDocumentBranding } from "./lib/branding";
import { hydrateInitialPageTheme } from "./lib/theme";
import { restoreRedirect } from "./lib/authUrls";

restoreRedirect();
hydrateInitialPageTheme();
resetDocumentBranding();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
