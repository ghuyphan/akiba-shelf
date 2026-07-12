import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Store, ExternalLink, LogOut, ArrowLeft, Layout } from "lucide-react";
import { useAdminSession } from "../hooks/useAdminSession";
import { signInAdmin, signOutAdmin } from "../lib/api";
import { AdminAccessCheck, AdminAccessDenied, LoginPanel } from "../components/admin/LoginPanel";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import "../styles/admin.css";

export function DashboardPage() {
  const { state: adminSession, refresh: refreshAdminSession } = useAdminSession();
  const navigate = useNavigate();
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);

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
                  <h3>{shop.shop_name}</h3>
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
    </div>
  );
}
