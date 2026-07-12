import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, ShoppingBag } from "lucide-react";
import { useAdminSession } from "../hooks/useAdminSession";
import { createShop, signInAdmin } from "../lib/api";
import { useAsyncAction } from "../hooks/useAsyncAction";
import { AdminAccessCheck, LoginPanel } from "../components/admin/LoginPanel";
import { Alert } from "../components/ui/Alert";
import { Field, TextInput } from "../components/ui/Field";
import { getErrorMessage } from "../lib/errors";
import "../styles/admin.css";

export function NewShopPage() {
  const { state: adminSession, refresh: refreshAdminSession } = useAdminSession();
  const navigate = useNavigate();
  const { busy, error, run, setError } = useAsyncAction();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEditedManually, setIsSlugEditedManually] = useState(false);
  const [localValidationError, setLocalValidationError] = useState("");

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
    setLocalValidationError("");
    setError("");

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (!trimmedName) {
      setLocalValidationError("Shop name is required.");
      return;
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (trimmedSlug.length < 2 || trimmedSlug.length > 63 || !slugRegex.test(trimmedSlug)) {
      setLocalValidationError(
        "Slug must be between 2 and 63 characters, contain only lowercase letters, numbers, and single dashes, and cannot start or end with a dash."
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
      setError(getErrorMessage(caught, "Could not create shop."));
    });
  }

  if (adminSession.status === "checking") {
    return <AdminAccessCheck />;
  }

  if (adminSession.status === "unauthenticated") {
    return <LoginPanel onLogin={handleLogin} />;
  }

  return (
    <main className="admin-login">
      <section className="admin-access-card admin-new-shop-card">
        <div className="admin-login-panel">
          <header className="admin-login-topbar">
            <div className="admin-login-brand">
              <span className="admin-login-logo">
                <ShoppingBag size={20} />
              </span>
              <span>
                <strong>Akiba Shelf</strong>
                <small>Platform onboarding</small>
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

            {localValidationError && (
              <Alert variant="error" title="Validation error" onClose={() => setLocalValidationError("")}>
                {localValidationError}
              </Alert>
            )}

            {error && (
              <Alert variant="error" title="Creation failed" onClose={() => setError("")}>
                {error}
              </Alert>
            )}

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
