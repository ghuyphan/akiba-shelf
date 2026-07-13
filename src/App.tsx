import { lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { useEffect } from "react";
import { ToastProvider } from "./components/ui/ToastProvider";
import { PageLoading } from "./components/ui/PageLoading";
import { PLATFORM_BRAND, resetDocumentBranding } from "./lib/branding";
import { resetPageTheme } from "./lib/theme";

const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const NewShopPage = lazy(() =>
  import("./pages/NewShopPage").then((m) => ({ default: m.NewShopPage })),
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })),
);
const CatalogPage = lazy(() =>
  import("./pages/CatalogPage").then((m) => ({ default: m.CatalogPage })),
);
const AuthPage = lazy(() =>
  import("./pages/AuthPage").then((m) => ({ default: m.AuthPage })),
);
const AuthCallbackPage = lazy(() =>
  import("./pages/AuthCallbackPage").then((m) => ({
    default: m.AuthCallbackPage,
  })),
);
const SetPasswordPage = lazy(() =>
  import("./pages/SetPasswordPage").then((m) => ({
    default: m.SetPasswordPage,
  })),
);

function PlatformRouteBranding() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (pathname === "/admin" || pathname.startsWith("/s/")) return;
    resetPageTheme();
    let title: string = PLATFORM_BRAND.name;
    if (pathname === "/auth") {
      const mode = new URLSearchParams(search).get("mode");
      title = `${mode === "signup" ? "Create account" : mode === "forgot" ? "Reset password" : "Sign in"} · ${PLATFORM_BRAND.name}`;
    } else if (pathname === "/dashboard")
      title = `Your shops · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/dashboard/shops/new")
      title = `Create a shop · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/auth/set-password")
      title = `Set password · ${PLATFORM_BRAND.name}`;
    else if (pathname === "/auth/callback")
      title = `Finishing sign in · ${PLATFORM_BRAND.name}`;
    resetDocumentBranding(title);
  }, [pathname, search]);
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

function RouteLoading() {
  return <PageLoading />;
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RouteAwareToastProvider>
        <PlatformRouteBranding />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/shops/new" element={<NewShopPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route path="/s/:shopSlug" element={<KeyedCatalogPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </RouteAwareToastProvider>
    </BrowserRouter>
  );
}
