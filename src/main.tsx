import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import "./styles/legacy.css";
import { App } from "./App";
import { applyStoredPageTheme } from "./lib/theme";
import { registerPwa } from "./lib/pwa";
import { restoreRedirect } from "./lib/authUrls";

restoreRedirect();
applyStoredPageTheme();
registerPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
