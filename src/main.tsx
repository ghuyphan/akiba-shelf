import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import "./styles/legacy.css";
import { App } from "./App";
import { applyStoredPageTheme } from "./lib/theme";

applyStoredPageTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
