import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";
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
    <section className="admin-login">
      <div className="admin-card admin-card-narrow">
        <div className="admin-title-row">
          <div className="admin-icon">
            <Lock size={24} />
          </div>
          <div>
            <h1>Admin Login</h1>
            <p>
              {isSupabaseConfigured
                ? "Sign in with your Supabase admin account."
                : "Supabase environment variables are required."}
            </p>
          </div>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Password">
            <TextInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          {error && (
            <Alert variant="error" title="Sign in failed" onClose={() => setError("")}>
              {error}
            </Alert>
          )}
          <Button type="submit" loading={busy} loadingText="Signing in..." disabled={!isSupabaseConfigured}>
            Sign In
          </Button>
        </form>
      </div>
    </section>
  );
}
