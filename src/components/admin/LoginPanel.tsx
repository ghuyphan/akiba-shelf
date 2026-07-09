import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";

type LoginPanelProps = {
  onLogin: (email: string, password: string) => Promise<void>;
};

export function LoginPanel({ onLogin }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run, setError } = useAsyncAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await run(() => onLogin(email, password)).catch(() => undefined);
  }

  return (
    <section 
      className="admin-login" 
      style={{ 
        position: "fixed", 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 9999, 
        display: "flex", 
        flexDirection: "column",
        justifyContent: "center", 
        alignItems: "center", 
        padding: "24px", 
        background: "var(--page-bg, #f8fafc)", 
        overflowY: "auto", 
        width: "100vw", 
        height: "100vh",
        userSelect: "none"
      }}
    >
      <div 
        className="admin-card"
        style={{ 
          width: "min(100%, 390px)", 
          zIndex: 1, 
          display: "flex", 
          flexDirection: "column",
          alignItems: "stretch",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--line, #e2e8f0)",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "var(--shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.05))"
        }}
      >
        {/* Title Block */}
        <div style={{ marginBottom: "36px", alignSelf: "flex-start" }}>
          <h1 
            style={{ 
              fontSize: "36px", 
              fontWeight: "900", 
              color: "var(--ink, #1e293b)", 
              margin: "0 0 6px 0", 
              letterSpacing: "-0.5px" 
            }}
          >
            Login
          </h1>
          <p style={{ fontSize: "15px", color: "var(--muted, #64748b)", margin: 0, fontWeight: "500" }}>
            Please sign in to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "24px" }}>
          {/* Email Container */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--muted, #94a3b8)", letterSpacing: "0.8px" }}>
              EMAIL
            </span>
            <div 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                background: "var(--surface, #ffffff)", 
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: "10px", 
                padding: "0 16px",
                height: "52px",
                boxShadow: "var(--shadow-sm)"
              }}
            >
              <Mail size={18} style={{ color: "var(--muted, #94a3b8)" }} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!isSupabaseConfigured}
                placeholder="user123@email.com"
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--ink, #1e293b)",
                  background: "transparent"
                }}
              />
            </div>
          </div>

          {/* Password Container */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--muted, #94a3b8)", letterSpacing: "0.8px" }}>
                PASSWORD
              </span>
            </div>
            <div 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                background: "var(--surface, #ffffff)", 
                border: "1px solid var(--line, #e2e8f0)",
                borderRadius: "10px", 
                padding: "0 16px",
                height: "52px",
                boxShadow: "var(--shadow-sm)"
              }}
            >
              <Lock size={18} style={{ color: "var(--muted, #94a3b8)" }} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!isSupabaseConfigured}
                placeholder="••••••••"
                style={{
                  border: "none",
                  outline: "none",
                  width: "100%",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--ink, #1e293b)",
                  background: "transparent"
                }}
              />
            </div>
          </div>

          {error && (
            <Alert variant="error" title="Sign in failed" onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          {/* Right Aligned Submit Pill Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
            <button
              type="submit"
              disabled={busy || !isSupabaseConfigured}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "var(--coral, #ff6fae)", 
                border: "none",
                borderRadius: "999px",
                padding: "0 28px",
                height: "46px",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "800",
                letterSpacing: "1px",
                cursor: busy ? "not-allowed" : "pointer",
                boxShadow: "0 8px 18px rgba(0, 0, 0, 0.08)",
                transition: "transform 150ms ease, opacity 150ms ease",
                opacity: busy ? 0.8 : 1
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {busy ? "SIGNING IN..." : "LOGIN"}
              <ArrowRight size={16} />
            </button>
          </div>
        </form>

        {/* Back Link */}
        <div style={{ marginTop: "48px", textAlign: "center" }}>
          <Link 
            to="/" 
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px", 
              fontSize: "13px", 
              color: "var(--muted, #64748b)", 
              textDecoration: "none",
              fontWeight: "600" 
            }}
          >
            <ArrowLeft size={16} />
            Go back to catalog
          </Link>
        </div>
      </div>
    </section>
  );
}
