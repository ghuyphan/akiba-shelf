import { Suspense, type ReactNode, useEffect } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { ToastProvider } from "./components/ui/ToastProvider";
import { PageLoading } from "./components/ui/PageLoading";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { configurePwa } from "./lib/offline/pwa";
import { lazyWithRetry } from "./utils/lazyWithRetry";

const PlatformLayout = lazyWithRetry("platform-layout", () =>
  import("./pages/PlatformLayout").then((m) => ({ default: m.PlatformLayout })),
);

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
const NotFoundPage = lazyWithRetry("not-found", () =>
  import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
);

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
    configurePwa(pathname);
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
                  <Suspense
                    fallback={
                      <div
                        style={{ background: "#ffffff", minHeight: "100vh" }}
                      />
                    }
                  >
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
                <Route
                  path="/auth/set-password"
                  element={<SetPasswordPage />}
                />
                <Route
                  path="/admin"
                  element={
                    <ErrorBoundary>
                      <AdminPage />
                    </ErrorBoundary>
                  }
                />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </RouteAwareToastProvider>
    </BrowserRouter>
  );
}
