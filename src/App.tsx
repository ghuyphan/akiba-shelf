import { lazy, Suspense, type ReactNode, type ComponentType } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { useEffect } from "react";
import { ToastProvider } from "./components/ui/ToastProvider";
import { PageLoading } from "./components/ui/PageLoading";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { PLATFORM_BRAND, resetDocumentBranding } from "./lib/branding";
import { resetPageTheme } from "./lib/theme";
import { PlatformI18nProvider, usePlatformI18n } from "./lib/platformI18n";
import { configurePwaForPath } from "./lib/pwa";

/**
 * Wraps `React.lazy` so that a failed dynamic import (typically caused by stale
 * chunk hashes after a new deployment) triggers a single hard reload instead of
 * crashing to a blank page.
 */
function lazyWithRetry<T extends ComponentType<Record<string, never>>>(
  chunkName: string,
  factory: () => Promise<{ default: T }>,
) {
  const retryKey = `chunk-reload:${chunkName}`;
  return lazy(() =>
    factory()
      .then((module) => {
        sessionStorage.removeItem(retryKey);
        return module;
      })
      .catch((error: unknown) => {
      if (!sessionStorage.getItem(retryKey)) {
        sessionStorage.setItem(retryKey, "1");
        window.location.reload();
        // Return a never-resolving promise so React keeps showing the
        // Suspense fallback while the browser navigates away.
        return new Promise<{ default: T }>(() => {});
      }
      // Already reloaded once — clear the flag and let the error propagate
      // so the user sees a real error rather than an infinite reload loop.
      sessionStorage.removeItem(retryKey);
      throw error;
      }),
  );
}

const HomePage = lazyWithRetry("home", () =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const DashboardPage = lazyWithRetry("dashboard", () =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const NewShopPage = lazyWithRetry("new-shop", () =>
  import("./pages/NewShopPage").then((m) => ({ default: m.NewShopPage })),
);
const AdminPage = lazyWithRetry("admin", () =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const CatalogPage = lazyWithRetry("catalog", () =>
  import("./pages/CatalogPage").then((m) => ({ default: m.CatalogPage })),
);
const GachaPage = lazyWithRetry("gacha", () =>
  import("./pages/GachaPage").then((m) => ({ default: m.GachaPage })),
);
const AuthPage = lazyWithRetry("auth", () =>
  import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })),
);
const AuthCallbackPage = lazyWithRetry("auth-callback", () =>
  import("./pages/AuthCallbackPage").then((m) => ({
    default: m.AuthCallbackPage,
  })),
);
const SetPasswordPage = lazyWithRetry("set-password", () =>
  import("./pages/SetPasswordPage").then((m) => ({
    default: m.SetPasswordPage,
  })),
);

function PlatformRouteBranding() {
  const { pathname, search } = useLocation();
  const { locale, t } = usePlatformI18n();
  useEffect(() => {
    if (pathname.startsWith("/s/")) return;
    document.documentElement.lang = locale;
    if (pathname === "/admin") return;
    resetPageTheme();
    let title: string = PLATFORM_BRAND.name;
    if (pathname === "/auth") {
      const mode = new URLSearchParams(search).get("mode");
      title = `${mode === "signup" ? t("Create account") : mode === "forgot" ? t("Reset password") : t("Sign in")} · ${PLATFORM_BRAND.name}`;
    } else if (pathname === "/dashboard")
      title = `${t("Your shops")} · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/dashboard/shops/new")
      title = `${t("Create a shop")} · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/auth/set-password")
      title = `${t("Set password")} · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/auth/callback")
      title = `${t("Finishing sign in")} · ${PLATFORM_BRAND.name}`;
    resetDocumentBranding(title);
  }, [locale, pathname, search, t]);
  return null;
}

function KeyedCatalogPage() {
  const { shopSlug = "" } = useParams();
  return <CatalogPage key={shopSlug} />;
}

function RouteAwareToastProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ToastProvider enabled={pathname !== "/"}>{children}</ToastProvider>;
}

function RouteAwarePwa() {
  const { pathname } = useLocation();
  useEffect(() => {
    configurePwaForPath(pathname);
  }, [pathname]);
  return null;
}

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

function RouteLoading() {
  return <PageLoading />;
}

function PlatformLayout() {
  return (
    <PlatformI18nProvider>
      <PlatformRouteBranding />
      <Outlet />
    </PlatformI18nProvider>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RouteAwarePwa />
      <RouteAwareToastProvider>
        <RouteErrorBoundary>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route
              path="/s/:shopSlug/play"
              element={
                <Suspense fallback={<div style={{ background: "#ffffff", minHeight: "100vh" }} />}>
                  <GachaPage />
                </Suspense>
              }
            />
            <Route path="/s/:shopSlug" element={<KeyedCatalogPage />} />
            <Route element={<PlatformLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/shops/new" element={<NewShopPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/set-password" element={<SetPasswordPage />} />
              <Route
                path="/admin"
                element={
                  <ErrorBoundary>
                    <AdminPage />
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
        </RouteErrorBoundary>
      </RouteAwareToastProvider>
    </BrowserRouter>
  );
}
