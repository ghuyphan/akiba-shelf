import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { PLATFORM_BRAND } from "../lib/branding";
import { PlatformMark } from "../components/ui/PlatformMark";
import { useAdminSession } from "../hooks/useAdminSession";
import { createShop, signInAdmin } from "../lib/api";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { AdminAccessCheck, AdminAccessDenied, LoginPanel } from "../components/admin/LoginPanel";
import { useToast } from "../components/ui/ToastProvider";
import { Alert } from "../components/ui/Alert";
import { Field, TextInput } from "../components/ui/Field";
import { getErrorMessage } from "../lib/errors";
import "../styles/admin.css";
import { usePlatformI18n } from "../lib/i18n/platformI18n";
import {
  MAX_OWNED_SHOPS,
  SHOP_NAME_MAX_LENGTH,
  SHOP_SLUG_MAX_LENGTH,
  SHOP_SLUG_MIN_LENGTH,
} from "../lib/constants";

export function NewShopPage() {
  const { state: adminSession, refresh: refreshAdminSession } = useAdminSession();
  const navigate = useNavigate();
  const { busy, run, setError } = useAsyncAction();
  const toast = useToast();
  const { t } = usePlatformI18n();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEditedManually, setIsSlugEditedManually] = useState(false);

  const ownedShopCount = adminSession.status === "authorized"
    ? adminSession.memberships.filter((shop) => shop.role === "owner").length
    : 0;
  const creationLimitReached = ownedShopCount >= MAX_OWNED_SHOPS;

  async function handleLogin(email: string, password: string) {
    await signInAdmin(email, password);
    await refreshAdminSession();
  }

  function suggestSlug(val: string) {
    return val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function handleNameChange(val: string) {
    setName(val);
    if (!isSlugEditedManually) {
      setSlug(suggestSlug(val));
    }
  }

  function handleSlugChange(val: string) {
    setIsSlugEditedManually(true);
    setSlug(val.toLowerCase().replace(/\s+/g, "-"));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (creationLimitReached) {
      toast.error(
        t("You can create up to {{limit}} shops. Joined shops do not count toward this limit.", { limit: MAX_OWNED_SHOPS }),
        t("Shop creation limit reached"),
      );
      return;
    }

    if (!trimmedName) {
      toast.error(t("Shop name is required."), t("Could not create shop"));
      return;
    }
    if (trimmedName.length > SHOP_NAME_MAX_LENGTH) {
      toast.error(
        t("Shop name must be between 1 and 100 characters."),
        t("Could not create shop"),
      );
      return;
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (
      trimmedSlug.length < SHOP_SLUG_MIN_LENGTH ||
      trimmedSlug.length > SHOP_SLUG_MAX_LENGTH ||
      !slugRegex.test(trimmedSlug)
    ) {
      toast.error(
        t("Slug must be between 2 and 63 characters, contain only lowercase letters, numbers, and single dashes, and cannot start or end with a dash."),
        t("Could not create shop"),
      );
      return;
    }

    await run(async () => {
      const newShop = await createShop(trimmedName, trimmedSlug);
      // Wait for session to refresh membership list
      await refreshAdminSession();
      // Set as active shop
      localStorage.setItem("akiba-active-shop", newShop.id);
      navigate("/admin");
    }).catch((caught) => {
      toast.error(t(getErrorMessage(caught, "Could not create shop.")), t("Creation failed"));
      setError("");
    });
  }

  if (adminSession.status === "checking") {
    return <AdminAccessCheck />;
  }

  if (adminSession.status === "unauthenticated") {
    return <LoginPanel onLogin={handleLogin} />;
  }
  if (adminSession.status === "error" || adminSession.status === "inactive") {
    return <AdminAccessDenied kind={adminSession.status} message={adminSession.status === "error" ? adminSession.message : undefined} onRetry={refreshAdminSession} onSignOut={async()=>{ await import("../lib/api").then(m=>m.signOutAdmin()); await refreshAdminSession(); }} />;
  }

  return (
    <main className="admin-login">
      <section className="admin-access-card admin-new-shop-card">
        <div className="admin-login-panel">
          <header className="admin-login-topbar">
            <div className="admin-login-brand">
              <span className="admin-login-logo">
                <PlatformMark />
              </span>
              <span>
                <strong>{PLATFORM_BRAND.name}</strong>
                <small>{t(PLATFORM_BRAND.descriptor)}</small>
              </span>
            </div>
            <div className="admin-login-topbar-actions">
              <Link
                to="/dashboard"
                className="admin-login-back"
                aria-label={t("Back to shops dashboard")}
              >
                <ArrowLeft size={17} />
              </Link>
            </div>
          </header>

          <div className="admin-login-heading">
            <h1>{t("Create your shop")}</h1>
            <p>{t("Set up your shop name and storefront URL slug to get started.")}</p>
            <small>{t("{{owned}} of {{limit}} created shops used", { owned: ownedShopCount, limit: MAX_OWNED_SHOPS })}</small>
          </div>

          {creationLimitReached ? <Alert title={t("Shop creation limit reached")}>
            {t("You can create up to {{limit}} shops. Joined shops do not count toward this limit.", { limit: MAX_OWNED_SHOPS })}
          </Alert> : <form onSubmit={handleSubmit} className="admin-login-form">
            <Field label={t("Shop name")} hint={t("A friendly name for your merch booth.")}>
              <TextInput
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("My Artist Booth")}
                maxLength={SHOP_NAME_MAX_LENGTH}
                required
                disabled={busy}
              />
            </Field>

            <Field
              label={t("Storefront URL slug")}
              hint={t("Only lowercase letters, numbers, and dashes. No spaces.")}
            >
              <div className="admin-slug-input-wrapper">
                <TextInput
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-artist-booth"
                  minLength={SHOP_SLUG_MIN_LENGTH}
                  maxLength={SHOP_SLUG_MAX_LENGTH}
                  required
                  disabled={busy}
                />
                {slug && (
                  <span className="admin-slug-preview">
                    {t("Preview URL:")} <strong>/s/{slug}</strong>
                  </span>
                )}
              </div>
            </Field>


            <button
              type="submit"
              className="admin-login-submit"
              disabled={busy || !name.trim() || !slug.trim()}
            >
              <span>{busy ? t("Creating shop…") : t("Create shop")}</span>
              <Plus size={18} />
            </button>
          </form>}
        </div>
      </section>
    </main>
  );
}
