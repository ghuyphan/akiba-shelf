import { FormEvent, useState } from "react";
import { Lock, ShieldCheck, ShoppingBag } from "lucide-react";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Field, TextInput } from "../ui/Field";

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
    <section className="admin-login" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "var(--page-bg, #f8fafc)" }}>
      <div className="admin-card admin-card-narrow" style={{ background: "var(--surface, #ffffff)", border: "1px solid var(--line)", boxShadow: "var(--shadow)", borderRadius: "16px", padding: "28px", width: "min(100%, 420px)" }}>
        <div className="admin-title-row" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px", marginBottom: "20px" }}>
          <div className="admin-icon" style={{ background: "rgba(99, 102, 241, 0.08)", color: "var(--coral, #6366f1)", width: "48px", height: "48px", borderRadius: "50%", display: "grid", placeItems: "center" }}>
            <ShoppingBag size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "900", color: "var(--ink)", margin: "0 0 4px 0" }}>Admin Login</h1>
            <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
              {isSupabaseConfigured
                ? "Sign in with your Supabase admin account."
                : "Supabase environment variables are required."}
            </p>
          </div>
        </div>
        
        <div className="login-trust-strip" style={{ display: "flex", justifyContent: "center", gap: "12px", marginBottom: "24px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)", background: "var(--surface-soft, #f8fafc)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <ShieldCheck size={14} style={{ color: "var(--teal, #10b981)" }} />
            Secure controls
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--muted)", background: "var(--surface-soft, #f8fafc)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <Lock size={14} style={{ color: "var(--coral, #6366f1)" }} />
            Admin only
          </span>
        </div>

        <form className="stack" onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
          <Field label="Email">
            <TextInput 
              type="email" 
              value={email} 
              onChange={(event) => setEmail(event.target.value)} 
              required 
              style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid var(--line)" }}
            />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              style={{ width: "100%", height: "40px", borderRadius: "8px", border: "1px solid var(--line)" }}
            />
          </Field>
          {error && (
            <Alert variant="error" title="Sign in failed" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          <Button 
            type="submit" 
            loading={busy} 
            loadingText="Signing in..." 
            disabled={!isSupabaseConfigured}
            style={{ width: "100%", height: "42px", borderRadius: "8px", marginTop: "8px" }}
          >
            Sign In
          </Button>
        </form>
      </div>
    </section>
  );
}
