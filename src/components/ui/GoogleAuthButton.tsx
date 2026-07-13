import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { signInWithGoogle } from "../../lib/api";
import { getAuthErrorNotice } from "../../lib/authErrors";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useToast } from "./ToastProvider";
import { usePlatformI18n } from "../../lib/platformI18n";

function GoogleMark() {
  return (
    <svg className="auth-google-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285f4"
        d="M21.35 12.19c0-.7-.06-1.2-.2-1.72H12v3.35h5.37a4.72 4.72 0 0 1-2 3.04l-.02.11 2.9 2.25.2.02c1.84-1.7 2.9-4.2 2.9-7.05Z"
      />
      <path
        fill="#34a853"
        d="M12 21.7c2.63 0 4.83-.87 6.45-2.46l-3.08-2.38c-.82.55-1.93.94-3.37.94a5.85 5.85 0 0 1-5.53-4.04l-.1.01-3.02 2.34-.04.1A9.74 9.74 0 0 0 12 21.7Z"
      />
      <path
        fill="#fbbc05"
        d="M6.47 13.76A5.98 5.98 0 0 1 6.15 12c0-.61.1-1.21.3-1.76v-.12L3.4 7.75l-.1.05A9.7 9.7 0 0 0 2.25 12c0 1.51.36 2.94 1.06 4.2l3.16-2.44Z"
      />
      <path
        fill="#ea4335"
        d="M12 6.2c1.83 0 3.06.79 3.76 1.44l2.75-2.69A9.33 9.33 0 0 0 12 2.3 9.74 9.74 0 0 0 3.3 7.8l3.15 2.44A5.88 5.88 0 0 1 12 6.2Z"
      />
    </svg>
  );
}

export function GoogleAuthButton({
  label,
}: {
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { t } = usePlatformI18n();

  async function startGoogleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      const notice = getAuthErrorNotice(error, "signin");
      toast.error(t(notice.message), t(notice.title));
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="auth-google-button"
      disabled={busy || !isSupabaseConfigured}
      aria-busy={busy}
      onClick={() => void startGoogleSignIn()}
    >
      {busy ? (
        <LoaderCircle className="button-spinner" size={19} aria-hidden="true" />
      ) : (
        <GoogleMark />
      )}
      <span>{busy ? t("Opening Google…") : (label ?? t("Continue with Google"))}</span>
    </button>
  );
}

export function AuthDivider() {
  const { t } = usePlatformI18n();
  return (
    <div className="auth-divider" aria-hidden="true">
      <span>{t("or")}</span>
    </div>
  );
}
