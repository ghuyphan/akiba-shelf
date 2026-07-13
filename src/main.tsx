import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import "./styles/legacy.css";
import { App } from "./App";
import { resetDocumentBranding } from "./lib/branding";
import { resetPageTheme } from "./lib/theme";
import { registerPwa } from "./lib/pwa";
import { restoreRedirect } from "./lib/authUrls";

restoreRedirect();
resetPageTheme();
resetDocumentBranding();
registerPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
