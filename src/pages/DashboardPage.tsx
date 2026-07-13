import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Store,
  ExternalLink,
  LogOut,
  ArrowLeft,
  Edit3,
} from "lucide-react";
import { PLATFORM_BRAND } from "../lib/branding";
import { PlatformMark } from "../components/ui/PlatformMark";
import { useAdminSession } from "../hooks/useAdminSession";
import { signInAdmin, signOutAdmin, updateShop } from "../lib/api";
import {
  AdminAccessCheck,
  AdminAccessDenied,
  LoginPanel,
} from "../components/admin/LoginPanel";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastProvider";
import { Field, TextInput } from "../components/ui/Field";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type { ShopMembership } from "../types/catalog";
import "../styles/admin.css";

export function DashboardPage() {
  const { state: adminSession, refresh: refreshAdminSession } =
    useAdminSession();
  const navigate = useNavigate();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const toast = useToast();

  // Edit shop states
  const [editingShop, setEditingShop] = useState<ShopMembership | null>(null);
  const [editName, setEditName] = useState("");
  const {
    busy: editBusy,
    run: runEdit,
    setError: setEditError,
  } = useAsyncAction();

  useEffect(() => {
    if (adminSession.status === "unauthorized") {
      navigate("/dashboard/shops/new", { replace: true });
    }
  }, [adminSession.status, navigate]);

  async function handleLogin(email: string, password: string) {
    await signInAdmin(email, password);
    await refreshAdminSession();
  }

  async function handleSignOut() {
    await signOutAdmin();
    setIsSignOutOpen(false);
    await refreshAdminSession();
  }

  function handleSelectShop(shopId: string) {
    localStorage.setItem("akiba-active-shop", shopId);
    navigate("/admin");
  }

  function startEditShop(shop: ShopMembership) {
    setEditingShop(shop);
    setEditName(shop.shop_name);
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingShop) return;

    const trimmedName = editName.trim();

    if (!trimmedName) {
      toast.error("Shop name is required.", "Could not save shop details");
      return;
    }

    let saved = false;
    await runEdit(async () => {
      await updateShop(editingShop.shop_id, trimmedName);
      saved = true;
    }).catch((err) =>
      toast.error(
        err instanceof Error ? err.message : String(err),
        "Could not save shop details",
      ),
    );

    if (saved) {
      setEditingShop(null);
      await refreshAdminSession();
    }
  }

  if (adminSession.status === "checking") {
    return <AdminAccessCheck />;
  }

  if (adminSession.status === "unauthenticated") {
    return <LoginPanel onLogin={handleLogin} />;
  }

  if (adminSession.status === "error") {
    return (
      <AdminAccessDenied
        kind="error"
        message={adminSession.message}
        onRetry={refreshAdminSession}
        onSignOut={handleSignOut}
      />
    );
  }

  if (
    adminSession.status !== "authorized" &&
    adminSession.status !== "inactive"
  ) {
    return null;
  }

  const { memberships } = adminSession;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-pill dashboard-header-pill">
          <div className="admin-header-brand">
            <Link
              to="/"
              className="admin-header-icon-button"
              aria-label="Back to home"
            >
              <ArrowLeft size={19} />
            </Link>
            <span className="admin-header-mark">
              <PlatformMark />
            </span>
            <div>
              <strong>{PLATFORM_BRAND.name}</strong>
              <small>{PLATFORM_BRAND.descriptor}</small>
            </div>
          </div>

          <div className="admin-header-actions">
            {adminSession.email && (
              <span className="dashboard-user-email">{adminSession.email}</span>
            )}
            <button
              type="button"
              onClick={() => setIsSignOutOpen(true)}
              className="admin-header-button admin-signout-button"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="admin-container">
        <section className="admin-view-hero">
          <div>
            <span>Your Account</span>
            <h1>Your shops</h1>
            <p>
              Select a shop workspace to manage orders, products, and designs,
              or preview its public storefront.
            </p>
          </div>
        </section>

        <div className="dashboard-grid">
          {memberships.map((shop) => {
            const available = shop.active && shop.shop_active;
            return (
              <div
                key={shop.shop_id}
                className={`dashboard-shop-card ${available ? "" : "inactive"}`}
              >
                <div className="shop-card-main">
                  <div className="shop-card-icon">
                    <Store size={22} />
                  </div>
                  <div className="shop-card-details">
                    <div className="shop-card-title-row">
                      <h3>{shop.shop_name}</h3>
                      {available && shop.role === "owner" && (
                        <button
                          type="button"
                          className="shop-card-edit-btn"
                          onClick={() => startEditShop(shop)}
                          title="Edit shop details"
                        >
                          <Edit3 size={13} />
                        </button>
                      )}
                    </div>
                    <code className="shop-card-slug">/s/{shop.shop_slug}</code>
                  </div>
                  <span className={`role-pill role-${shop.role}`}>
                    {available
                      ? shop.role
                      : shop.shop_active
                        ? "Access disabled"
                        : "Shop unavailable"}
                  </span>
                </div>
                <div className="shop-card-actions">
                  {available && (
                    <Button
                      variant="primary"
                      onClick={() => handleSelectShop(shop.shop_id)}
                      className="shop-card-manage-btn"
                    >
                      Manage shop
                    </Button>
                  )}
                  {shop.shop_active && (
                    <Link
                      to={`/s/${shop.shop_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button button-secondary shop-card-preview-btn"
                    >
                      <ExternalLink size={15} />
                      <span>Storefront</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          <Link to="/dashboard/shops/new" className="dashboard-create-card">
            <div className="create-card-content">
              <span className="create-card-plus">
                <Plus size={24} />
              </span>
              <h3>Create another shop</h3>
              <p>
                Add a new storefront and manage its inventory, custom design,
                and orders.
              </p>
            </div>
          </Link>
        </div>
      </main>

      <Modal
        title="Sign out of your account?"
        isOpen={isSignOutOpen}
        onClose={() => setIsSignOutOpen(false)}
        className="signout-modal"
      >
        <div className="signout-confirmation">
          <span className="signout-confirmation-icon">
            <LogOut size={22} />
          </span>
          <div>
            <h3>Your work is saved.</h3>
            <p>You’ll sign out of the platform dashboard and all shops.</p>
          </div>
          <div className="signout-confirmation-actions">
            <Button variant="secondary" onClick={() => setIsSignOutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSignOut()}>Sign out</Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Edit shop details"
        isOpen={editingShop !== null}
        onClose={() => setEditingShop(null)}
        className="edit-shop-modal"
      >
        <form
          onSubmit={handleSaveEdit}
          className="admin-form dashboard-edit-form"
        >
          <div className="dashboard-edit-intro">
            <span className="dashboard-edit-icon" aria-hidden="true">
              <Store size={20} />
            </span>
            <p>Update the name customers see across your storefront.</p>
          </div>

          <section className="dashboard-edit-section">
            <Field label="Shop name">
              <TextInput
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="My shop name"
                disabled={editBusy}
                required
              />
            </Field>
            <div className="dashboard-url-field">
              <span className="field-label">Storefront URL</span>
              <div className="dashboard-url-readout">
                <code>/s/{editingShop?.shop_slug}</code>
                <span>Fixed</span>
              </div>
              <span className="field-hint">
                Shop URLs cannot currently be changed after creation.
              </span>
            </div>
          </section>

          <div className="dashboard-edit-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={editBusy}
              onClick={() => setEditingShop(null)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={editBusy} loadingText="Saving…">
              Save changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
