import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Store, ExternalLink, LogOut, ArrowLeft, Layout, Edit3, X } from "lucide-react";
import { useAdminSession } from "../hooks/useAdminSession";
import { signInAdmin, signOutAdmin, updateShop } from "../lib/api";
import { AdminAccessCheck, AdminAccessDenied, LoginPanel } from "../components/admin/LoginPanel";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/ToastProvider";
import { Field, TextInput } from "../components/ui/Field";
import { useAsyncAction } from "../hooks/useAsyncAction";
import type { ShopMembership } from "../types/catalog";
import "../styles/admin.css";

export function DashboardPage() {
  const { state: adminSession, refresh: refreshAdminSession } = useAdminSession();
  const navigate = useNavigate();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const toast = useToast();

  // Edit shop states
  const [editingShop, setEditingShop] = useState<ShopMembership | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const { busy: editBusy, run: runEdit, setError: setEditError } = useAsyncAction();

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
    setEditSlug(shop.shop_slug);
    setEditError("");
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingShop) return;

    const trimmedName = editName.trim();
    const trimmedSlug = editSlug.toLowerCase().trim();

    if (!trimmedName) {
      toast.error("Shop name is required.", "Could not save shop details");
      return;
    }
    if (trimmedSlug.length < 2 || trimmedSlug.length > 63) {
      toast.error("Slug must be between 2 and 63 characters.", "Could not save shop details");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      toast.error("Slug must contain only lowercase alphanumeric characters and single dashes.", "Could not save shop details");
      return;
    }

    let saved = false;
    await runEdit(async () => {
      await updateShop(editingShop.shop_id, trimmedName);
      saved = true;
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate key") || msg.includes("shops_slug_key")) {
        toast.error("This shop URL slug is already taken. Please try another one.", "Could not save shop details");
      } else {
        toast.error(msg, "Could not save shop details");
      }
    });

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

  if (adminSession.status === "error" || adminSession.status === "inactive") {
    return (
      <AdminAccessDenied
        kind={adminSession.status}
        message={adminSession.status === "error" ? adminSession.message : undefined}
        onRetry={refreshAdminSession}
        onSignOut={handleSignOut}
      />
    );
  }

  if (adminSession.status !== "authorized") {
    return null;
  }

  const { memberships } = adminSession;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-pill">
          <div className="admin-header-brand">
            <Link to="/" className="admin-header-icon-button" aria-label="Back to home">
              <ArrowLeft size={19} />
            </Link>
            <span className="admin-header-mark">
              <Layout size={18} />
            </span>
            <div>
              <strong>Akiba Shelf</strong>
              <small>Platform dashboard</small>
            </div>
          </div>

          <div />

          <div className="admin-header-actions">
            {adminSession.email && (
              <span className="dashboard-user-email">
                {adminSession.email}
              </span>
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
            <p>Select a shop workspace to manage orders, products, and designs, or preview its public storefront.</p>
          </div>
        </section>

        <div className="dashboard-grid">
          {memberships.map((shop) => (
            <div key={shop.shop_id} className="dashboard-shop-card">
              <div className="shop-card-main">
                <div className="shop-card-icon">
                  <Store size={22} />
                </div>
                <div className="shop-card-details">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3>{shop.shop_name}</h3>
                    {shop.role === "owner" && (
                      <button
                        type="button"
                        className="shop-card-edit-btn"
                        onClick={() => startEditShop(shop)}
                        title="Edit shop details"
                        style={{
                          background: "none",
                          border: "none",
                          padding: "4px",
                          color: "var(--muted)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: "4px",
                          transition: "color 150ms ease, background-color 150ms ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--coral)";
                          e.currentTarget.style.backgroundColor = "var(--surface-soft, rgba(0,0,0,0.04))";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--muted)";
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <Edit3 size={13} />
                      </button>
                    )}
                  </div>
                  <code className="shop-card-slug">/s/{shop.shop_slug}</code>
                </div>
                <span className={`role-pill role-${shop.role}`}>
                  {shop.role}
                </span>
              </div>
              <div className="shop-card-actions">
                <Button
                  variant="primary"
                  onClick={() => handleSelectShop(shop.shop_id)}
                  className="shop-card-manage-btn"
                >
                  Manage shop
                </Button>
                <Link
                  to={`/s/${shop.shop_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button button-secondary shop-card-preview-btn"
                >
                  <ExternalLink size={15} />
                  <span>Storefront</span>
                </Link>
              </div>
            </div>
          ))}

          <Link to="/dashboard/shops/new" className="dashboard-create-card">
            <div className="create-card-content">
              <span className="create-card-plus">
                <Plus size={24} />
              </span>
              <h3>Create another shop</h3>
              <p>Add a new storefront and manage its inventory, custom design, and orders.</p>
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
        <form onSubmit={handleSaveEdit} className="admin-form" style={{ padding: "20px" }}>
          <section className="admin-form-section" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
            <Field label="Shop name">
              <TextInput
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                placeholder="My shop name"
                disabled={editBusy}
                required
              />
            </Field>
            <Field label="Shop URL slug" hint="Required. Only lowercase letters, numbers, and dashes.">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "var(--muted)", fontSize: "14px", userSelect: "none" }}>/s/</span>
                <TextInput
                  value={editSlug}
                  onChange={(event) => setEditSlug(event.target.value)}
                  placeholder="shop-url-slug"
                  disabled={editBusy}
                  required
                />
              </div>
            </Field>
          </section>


          <div className="admin-sticky-actions" style={{ position: "relative", marginTop: "24px", padding: 0 }}>
            <Button type="submit" loading={editBusy} loadingText="Saving…">
              Save changes
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<X size={17} />}
              disabled={editBusy}
              onClick={() => setEditingShop(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
