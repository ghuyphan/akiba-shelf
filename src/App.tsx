import { Suspense, type ReactNode, useEffect } from "react";
import {
  createBrowserRouter,
  Route,
  RouterProvider,
  Routes,
  useLocation,
  useParams,
} from "react-router";
import { ToastProvider } from "./components/ui/ToastProvider";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { PageLoading } from "./components/ui/PageLoading";
import { lazyWithRetry } from "./utils/lazyWithRetry";

const PlatformLayout = lazyWithRetry("platform-layout", () =>
  import("./pages/platform/PlatformLayout").then((m) => ({ default: m.PlatformLayout })),
);

const HomePage = lazyWithRetry("home", () =>
  import("./pages/platform/HomePage").then((m) => ({ default: m.HomePage })),
);
const SupportPage = lazyWithRetry("support", () =>
  import("./pages/platform/SupportPage").then((m) => ({ default: m.SupportPage })),
);
const DashboardPage = lazyWithRetry("dashboard", () =>
  import("./pages/admin/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const NewShopPage = lazyWithRetry("new-shop", () =>
  import("./pages/admin/NewShopPage").then((m) => ({ default: m.NewShopPage })),
);
const AdminPage = lazyWithRetry("admin", () =>
  import("./pages/admin/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const CatalogPage = lazyWithRetry("catalog", () =>
  import("./pages/catalog/CatalogPage").then((m) => ({ default: m.CatalogPage })),
);
const GachaPage = lazyWithRetry("gacha", () =>
  import("./pages/catalog/GachaPage").then((m) => ({ default: m.GachaPage })),
);
const AuthPage = lazyWithRetry("auth", () =>
  import("./pages/auth/AuthPage").then((m) => ({ default: m.AuthPage })),
);
const AuthCallbackPage = lazyWithRetry("auth-callback", () =>
  import("./pages/auth/AuthCallbackPage").then((m) => ({
    default: m.AuthCallbackPage,
  })),
);
const SetPasswordPage = lazyWithRetry("set-password", () =>
  import("./pages/auth/SetPasswordPage").then((m) => ({
    default: m.SetPasswordPage,
  })),
);
const NotFoundPage = lazyWithRetry("not-found", () =>
  import("./pages/platform/NotFoundPage").then((m) => ({ default: m.NotFoundPage })),
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
    let cancelled = false;
    let delayTimer: number | undefined;
    let idleCallback: number | undefined;

    const configure = () => {
      if (cancelled) return;
      void import("./lib/offline/pwa")
        .then(({ configurePwa }) => {
          if (!cancelled) configurePwa(pathname);
        })
        .catch(() => undefined);
    };
    const scheduleAfterLoad = () => {
      delayTimer = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idleCallback = window.requestIdleCallback(configure, {
            timeout: 4_000,
          });
        } else {
          configure();
        }
      }, 1_500);
    };

    if (document.readyState === "complete") scheduleAfterLoad();
    else window.addEventListener("load", scheduleAfterLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", scheduleAfterLoad);
      window.clearTimeout(delayTimer);
      if (idleCallback !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleCallback);
      }
    };
  }, [pathname]);
  return null;
}

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

function RouteLoading() {
  const storefront = /^\/s\/[^/]+\/?$/.test(window.location.pathname);
  return (
    <PageLoading
      title={storefront ? "Opening the shop…" : "Preparing Matsuri"}
      message={
        storefront
          ? "Getting the shelves ready for you."
          : "Getting everything ready…"
      }
    />
  );
}

function AppRoutes() {
  return (
    <>
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
                <Route path="/support" element={<SupportPage />} />
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
    </>
  );
}

const router = createBrowserRouter([{ path: "*", element: <AppRoutes /> }], {
  basename: import.meta.env.BASE_URL,
});

export function App() {
  return <RouterProvider router={router} />;
}
