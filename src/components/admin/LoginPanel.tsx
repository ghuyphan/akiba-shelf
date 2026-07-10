import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Lock, Mail, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
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
    <main className="admin-login">
      <section className="admin-login-card">
        <div className="admin-login-intro">
          <div className="admin-login-brand">
            <span><ShoppingBag size={22} /></span>
            Merch desk
          </div>
          <div>
            <p className="admin-login-kicker"><Sparkles size={15} /> Booth operations</p>
            <h1>Run the booth without the clutter.</h1>
            <p>Review orders, update inventory, and keep payment details current from one calm workspace.</p>
          </div>
          <div className="admin-login-trust">
            <ShieldCheck size={18} />
            <span><strong>Staff-only access</strong><small>Protected by your Supabase account</small></span>
          </div>
        </div>

        <div className="admin-login-form-wrap">
          <Link to="/" className="admin-login-back"><ArrowLeft size={16} /> Back to catalog</Link>
          <div className="admin-login-heading">
            <span className="admin-login-icon"><Lock size={22} /></span>
            <div><h2>Welcome back</h2><p>Sign in to open the admin workspace.</p></div>
          </div>

          <form onSubmit={handleSubmit} className="admin-login-form">
            <label>
              <span>Email address</span>
              <div className="admin-login-input"><Mail size={19} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={!isSupabaseConfigured} autoComplete="email" placeholder="staff@example.com" /></div>
            </label>
            <label>
              <span>Password</span>
              <div className="admin-login-input"><Lock size={19} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={!isSupabaseConfigured} autoComplete="current-password" placeholder="Enter your password" /></div>
            </label>

            {error && <Alert variant="error" title="Sign in failed" onClose={() => setError("")}>{error}</Alert>}
            {!isSupabaseConfigured && <Alert variant="error" title="Supabase is not configured">Add the Supabase URL and public key before signing in.</Alert>}

            <button type="submit" className="admin-login-submit" disabled={busy || !isSupabaseConfigured}>
              <span>{busy ? "Signing in…" : "Open admin"}</span><ArrowRight size={18} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
