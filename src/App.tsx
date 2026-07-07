import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { CatalogPage } from "./pages/CatalogPage";

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
