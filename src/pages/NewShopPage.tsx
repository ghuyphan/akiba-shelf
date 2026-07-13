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
import { Field, TextInput } from "../components/ui/Field";
import { getErrorMessage } from "../lib/errors";
import "../styles/admin.css";

export function NewShopPage() {
  const { state: adminSession, refresh: refreshAdminSession } = useAdminSession();
  const navigate = useNavigate();
  const { busy, run, setError } = useAsyncAction();
  const toast = useToast();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEditedManually, setIsSlugEditedManually] = useState(false);

  const hasShops = adminSession.status === "authorized" && adminSession.memberships.length > 0;

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

    if (!trimmedName) {
      toast.error("Shop name is required.", "Could not create shop");
      return;
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (trimmedSlug.length < 2 || trimmedSlug.length > 63 || !slugRegex.test(trimmedSlug)) {
      toast.error(
        "Slug must be between 2 and 63 characters, contain only lowercase letters, numbers, and single dashes, and cannot start or end with a dash."
        , "Could not create shop"
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
      toast.error(getErrorMessage(caught, "Could not create shop."), "Creation failed");
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
                <small>{PLATFORM_BRAND.descriptor}</small>
              </span>
            </div>
            <Link
              to={hasShops ? "/dashboard" : "/"}
              className="admin-login-back"
              aria-label={hasShops ? "Back to shops dashboard" : "Back to homepage"}
            >
              <ArrowLeft size={17} />
            </Link>
          </header>

          <div className="admin-login-heading">
            <h1>Create your shop</h1>
            <p>Set up your shop name and storefront URL slug to get started.</p>
          </div>

          <form onSubmit={handleSubmit} className="admin-login-form">
            <Field label="Shop name" hint="A friendly name for your merch booth.">
              <TextInput
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="My Artist Booth"
                required
                disabled={busy}
              />
            </Field>

            <Field
              label="Storefront URL slug"
              hint="Only lowercase letters, numbers, and dashes. No spaces."
            >
              <div className="admin-slug-input-wrapper">
                <TextInput
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-artist-booth"
                  required
                  disabled={busy}
                />
                {slug && (
                  <span className="admin-slug-preview">
                    Preview URL: <strong>/s/{slug}</strong>
                  </span>
                )}
              </div>
            </Field>


            <button
              type="submit"
              className="admin-login-submit"
              disabled={busy || !name.trim() || !slug.trim()}
            >
              <span>{busy ? "Creating shop…" : "Create shop"}</span>
              <Plus size={18} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
