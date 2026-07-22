import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ToastLocalization } from "../components/ui/ToastProvider";
import { PLATFORM_BRAND, resetDocumentBranding } from "../lib/branding";
import {
  PlatformI18nProvider,
  usePlatformI18n,
} from "../lib/i18n/platformI18n";
import { applyDocumentSeo } from "../lib/seo";
import { resetPageTheme } from "../utils/theme";

function PlatformRouteBranding() {
  const { pathname, search } = useLocation();
  const { locale, t } = usePlatformI18n();

  useEffect(() => {
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
    } else if (pathname === "/dashboard") {
      title = `${t("Your shops")} · ${PLATFORM_BRAND.name}`;
    } else if (pathname === "/dashboard/shops/new") {
      title = `${t("Create a shop")} · ${PLATFORM_BRAND.name}`;
    } else if (pathname === "/auth/set-password") {
      title = `${t("Set password")} · ${PLATFORM_BRAND.name}`;
    } else if (pathname === "/auth/callback") {
      title = `${t("Finishing sign in")} · ${PLATFORM_BRAND.name}`;
    } else {
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

function PlatformLayoutContent() {
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

export function PlatformLayout() {
  return (
    <PlatformI18nProvider>
      <PlatformLayoutContent />
    </PlatformI18nProvider>
  );
}
