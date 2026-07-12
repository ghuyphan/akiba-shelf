import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/ui/ToastProvider";
import { PageLoading } from "./components/ui/PageLoading";
const AdminPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const CatalogPage = lazy(() => import("./pages/CatalogPage").then((m) => ({ default: m.CatalogPage })));

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Suspense fallback={<PageLoading />}><Routes>
          <Route path="/" element={<Navigate to="/s/akiba-shelf" replace />} />
          <Route path="/s/:shopSlug" element={<CatalogPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
