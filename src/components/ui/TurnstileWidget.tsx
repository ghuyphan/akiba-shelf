import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const TURNSTILE_SCRIPT_ID = "matsuri-turnstile-api";
const TURNSTILE_ACTION = "turnstile-spin-v2";
const COMPACT_QUERY = "(max-width: 340px)";

type TurnstileSize = "flexible" | "compact";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: "always";
      size: TurnstileSize;
      theme: "light";
      language: "auto";
      "response-field": false;
      callback: (token: string) => void;
      "error-callback": () => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileLoader: Promise<TurnstileApi> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoader) return turnstileLoader;

  turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("Turnstile loaded without a browser API."));
    };
    const fail = () => reject(new Error("Turnstile could not be loaded."));
    const existing = document.getElementById(
      TURNSTILE_SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.append(script);
  }).catch((error) => {
    turnstileLoader = null;
    throw error;
  });

  return turnstileLoader;
}

export type TurnstileWidgetHandle = {
  reset: () => void;
};

type TurnstileWidgetProps = {
  onTokenChange: (token: string | null) => void;
  loadingLabel: string;
  errorLabel: string;
  missingLabel: string;
  className?: string;
};

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget(
  { onTokenChange, loadingLabel, errorLabel, missingLabel, className },
  ref,
) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
  const testBypass =
    import.meta.env.DEV &&
    import.meta.env.VITE_TURNSTILE_TEST_BYPASS === "true";
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [compact, setCompact] = useState(() =>
    window.matchMedia(COMPACT_QUERY).matches,
  );
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "missing"
  >(() => (siteKey || testBypass ? "loading" : "missing"));
  const size: TurnstileSize = compact ? "compact" : "flexible";

  onTokenChangeRef.current = onTokenChange;

  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const issueTestToken = () => {
    setStatus("ready");
    onTokenChangeRef.current("turnstile-test-token");
  };

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenChangeRef.current(null);
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) {
        window.turnstile.reset(widgetId);
      } else if (testBypass) {
        window.queueMicrotask(issueTestToken);
      }
    },
  }));

  useEffect(() => {
    if (testBypass) {
      issueTestToken();
      return;
    }
    if (!siteKey || !containerRef.current) {
      setStatus("missing");
      onTokenChangeRef.current(null);
      return;
    }

    let cancelled = false;
    const container = containerRef.current;
    setStatus("loading");
    onTokenChangeRef.current(null);

    void loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetIdRef.current = api.render(container, {
          sitekey: siteKey,
          action: TURNSTILE_ACTION,
          appearance: "always",
          size,
          theme: "light",
          language: "auto",
          "response-field": false,
          callback: (token) => {
            setStatus("ready");
            onTokenChangeRef.current(token);
          },
          "error-callback": () => {
            setStatus("error");
            onTokenChangeRef.current(null);
          },
          "expired-callback": () => {
            setStatus("loading");
            onTokenChangeRef.current(null);
          },
          "timeout-callback": () => {
            setStatus("loading");
            onTokenChangeRef.current(null);
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
        onTokenChangeRef.current(null);
      });

    return () => {
      cancelled = true;
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      widgetIdRef.current = null;
      container.replaceChildren();
    };
  }, [siteKey, size, testBypass]);

  const statusLabel =
    status === "error"
      ? errorLabel
      : status === "missing"
        ? missingLabel
        : loadingLabel;

  return (
    <div
      className={`turnstile-shell turnstile-shell-${size}${className ? ` ${className}` : ""}`}
      data-state={status}
      data-size={size}
    >
      <div
        ref={containerRef}
        className="cf-turnstile"
        data-sitekey={siteKey || undefined}
        data-action={TURNSTILE_ACTION}
      />
      {status !== "ready" && (
        <div className="turnstile-status" role="status" aria-live="polite">
          <span className="turnstile-status-dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>
      )}
    </div>
  );
});
