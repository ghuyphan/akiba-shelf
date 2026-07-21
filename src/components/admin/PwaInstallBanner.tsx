import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share2, Smartphone, X } from "lucide-react";
import {
  getPwaInstallState,
  promptPwaInstall,
  subscribeToPwaInstallState,
  type PwaInstallState,
} from "../../lib/offline/pwa";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";

const DISMISS_KEY = "matsuri-pwa-install-dismissed-at";
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_FOR_MS;
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const [isPhoneLayout, setIsPhoneLayout] = useState(() =>
    window.matchMedia("(max-width: 760px)").matches,
  );
  const [installState, setInstallState] = useState<PwaInstallState>(() =>
    getPwaInstallState(),
  );
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const { t } = usePlatformI18n();

  useEffect(() => {
    const phoneLayout = window.matchMedia("(max-width: 760px)");
    const handleChange = (event: MediaQueryListEvent) =>
      setIsPhoneLayout(event.matches);
    phoneLayout.addEventListener("change", handleChange);
    return () => phoneLayout.removeEventListener("change", handleChange);
  }, []);

  useEffect(
    () =>
      subscribeToPwaInstallState(() => {
        setInstallState(getPwaInstallState());
      }),
    [],
  );

  if (
    !isPhoneLayout ||
    dismissed ||
    installState === "installed" ||
    installState === "unavailable"
  )
    return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // The in-memory dismissal still works when storage is unavailable.
    }
    setDismissed(true);
  }

  async function install() {
    if (installState === "ios") {
      setShowIosHelp((current) => !current);
      return;
    }
    setBusy(true);
    try {
      const outcome = await promptPwaInstall();
      if (outcome === "accepted") setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  const banner = (
    <aside className="staff-install-banner" aria-label={t("Install Matsuri staff app")}>
      <span className="staff-install-banner-icon" aria-hidden="true">
        <Smartphone size={19} />
      </span>
      <div className="staff-install-banner-copy">
        <strong>{t("Keep Matsuri close")}</strong>
        <span>{t("Install the staff app for quicker access to shops and orders.")}</span>
        {showIosHelp && (
          <small>
            <Share2 size={13} aria-hidden="true" />
            {t("Tap Share, then Add to Home Screen.")}
          </small>
        )}
      </div>
      <button
        type="button"
        className="staff-install-banner-action"
        disabled={busy}
        onClick={() => void install()}
      >
        <Download size={15} aria-hidden="true" />
        <span>{t(installState === "ios" ? "How to install" : busy ? "Opening…" : "Install")}</span>
      </button>
      <button
        type="button"
        className="staff-install-banner-dismiss"
        onClick={dismiss}
        aria-label={t("Dismiss install suggestion")}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </aside>
  );

  return typeof document === "undefined"
    ? banner
    : createPortal(banner, document.body);
}
