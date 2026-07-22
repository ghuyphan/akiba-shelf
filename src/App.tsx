import { Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { useEffect } from "react";
import {
  ToastLocalization,
  ToastProvider,
} from "./components/ui/ToastProvider";
import { PageLoading } from "./components/ui/PageLoading";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { PLATFORM_BRAND, resetDocumentBranding } from "./lib/branding";
import { resetPageTheme } from "./utils/theme";
import { PlatformI18nProvider, usePlatformI18n } from "./lib/i18n/platformI18n";
import { configurePwa } from "./lib/offline/pwa";
import { lazyWithRetry } from "./utils/lazyWithRetry";
import { applyDocumentSeo } from "./lib/seo";

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

function PlatformRouteBranding() {
  const { pathname, search } = useLocation();
  const { locale, t } = usePlatformI18n();
  useEffect(() => {
    if (pathname.startsWith("/s/")) return;
    document.documentElement.lang = locale;
    if (pathname === "/admin") {
      applyDocumentSeo({
        description: t("Secure workspace for managing a Matsuri shop."),
        canonicalPath: pathname,
        robots: "noindex, nofollow",
      });
      return;
    }
    resetPageTheme();
    let title: string = PLATFORM_BRAND.name;
    let description = t(
      "Matsuri helps independent artists run a branded merch storefront with reliable stock reservation and a live order queue for event teams.",
    );
    let robots: "index, follow" | "noindex, nofollow" = "noindex, nofollow";
    if (pathname === "/auth") {
      const mode = new URLSearchParams(search).get("mode");
      title = `${mode === "signup" ? t("Create account") : mode === "forgot" ? t("Reset password") : t("Sign in")} · ${PLATFORM_BRAND.name}`;
    } else if (pathname === "/") {
      title = `${PLATFORM_BRAND.name} · ${t("Artist booth storefront and live orders")}`;
      robots = "index, follow";
    } else if (pathname === "/dashboard")
      title = `${t("Your shops")} · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/dashboard/shops/new")
      title = `${t("Create a shop")} · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/auth/set-password")
      title = `${t("Set password")} · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/auth/callback")
      title = `${t("Finishing sign in")} · ${PLATFORM_BRAND.name}`;
    else {
      title = `${t("Page not found")} · ${PLATFORM_BRAND.name}`;
      description = t(
        "This Matsuri page could not be found. Return home or visit the demo artist booth.",
      );
    }
    resetDocumentBranding(title);
    applyDocumentSeo({
      description,
      canonicalPath: pathname === "/" ? "/" : pathname,
      robots,
    });
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

function PlatformLayout() {
  const { t } = usePlatformI18n();
  return (
    <>
      <ToastLocalization
        labels={{
          successTitle: t("Done"),
          errorTitle: t("Something went wrong"),
          infoTitle: t("Notice"),
          dismiss: t("Dismiss notification"),
        }}
      />
      <PlatformRouteBranding />
      <Outlet />
    </>
  );
}

function PlatformLayoutProvider() {
  return (
    <PlatformI18nProvider>
      <PlatformLayout />
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
              <Route element={<PlatformLayoutProvider />}>
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
