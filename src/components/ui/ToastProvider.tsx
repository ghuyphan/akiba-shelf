import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { safeUuid } from "../../utils/id";

export type ToastVariant = "info" | "success" | "error";
type ToastInput = { title?: string; message: string; variant?: ToastVariant; duration?: number };
type ToastItem = Required<Pick<ToastInput, "message" | "variant">> & Omit<ToastInput, "message" | "variant"> & { id: string };
type ToastApi = {
  show: (toast: ToastInput) => string;
  info: (message: string, title?: string) => string;
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  dismiss: (id: string) => void;
};

export type ToastLabels = {
  successTitle: string;
  errorTitle: string;
  infoTitle: string;
  dismiss: string;
};

const defaultLabels: ToastLabels = {
  successTitle: "Done",
  errorTitle: "Something went wrong",
  infoTitle: "Notice",
  dismiss: "Dismiss notification",
};

const ToastContext = createContext<ToastApi | null>(null);
const ToastLabelsContext = createContext<
  ((labels: ToastLabels | null) => void) | null
>(null);
const icons = { info: Info, success: CheckCircle2, error: AlertCircle };

export function ToastProvider({ children, enabled = true, labels = defaultLabels }: { children: ReactNode; enabled?: boolean; labels?: ToastLabels }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exitingIds, setExitingIds] = useState<string[]>([]);
  const [localizedLabels, setLocalizedLabels] = useState<ToastLabels | null>(null);
  const timersRef = useRef(new Map<string, number>());
  const activeLabels = localizedLabels ?? labels;

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  useEffect(() => {
    if (enabled) return;
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
    setExitingIds([]);
  }, [enabled]);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
    setExitingIds((prev) => prev.includes(id) ? prev : [...prev, id]);
    const exitTimer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      setExitingIds((prev) => prev.filter((x) => x !== id));
      timersRef.current.delete(id);
    }, 180);
    timersRef.current.set(id, exitTimer);
  }, []);

  const show = useCallback((input: ToastInput) => {
    const id = safeUuid();
    if (!enabled) return id;
    const toast: ToastItem = { ...input, id, variant: input.variant ?? "info" };
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
    setExitingIds([]);
    setToasts([toast]);
    const duration = input.duration ?? (toast.variant === "error" ? 6500 : 4000);
    const timer = window.setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss, enabled]);

  const api = useMemo<ToastApi>(() => ({
    show,
    info: (message, title) => show({ message, title, variant: "info" }),
    success: (message, title) => show({ message, title, variant: "success" }),
    error: (message, title) => show({ message, title, variant: "error" }),
    dismiss,
  }), [dismiss, show]);

  return <ToastContext.Provider value={api}><ToastLabelsContext.Provider value={setLocalizedLabels}>{children}{enabled && createPortal(
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = icons[toast.variant];
        const isClosing = exitingIds.includes(toast.id);
        return <div
          key={toast.id}
          className={`toast toast-${toast.variant} ${isClosing ? "is-closing" : "is-open"}`}
          style={{ "--toast-duration": `${toast.duration ?? (toast.variant === "error" ? 6500 : 4000)}ms` } as CSSProperties}
          role={toast.variant === "error" ? "alert" : "status"}
        >
          <span className="toast-icon"><Icon size={17} /></span>
          <div><strong>{toast.title ?? (toast.variant === "success" ? activeLabels.successTitle : toast.variant === "error" ? activeLabels.errorTitle : activeLabels.infoTitle)}</strong><p>{toast.message}</p></div>
          <button type="button" aria-label={activeLabels.dismiss} onClick={() => dismiss(toast.id)}><X size={14} /></button>
          <span className="toast-life" aria-hidden="true" />
        </div>;
      })}
    </div>, document.body)}</ToastLabelsContext.Provider></ToastContext.Provider>;
}

export function ToastLocalization({ labels }: { labels: ToastLabels }) {
  const setLabels = useContext(ToastLabelsContext);
  const { dismiss, errorTitle, infoTitle, successTitle } = labels;
  useLayoutEffect(() => {
    setLabels?.({ dismiss, errorTitle, infoTitle, successTitle });
    return () => setLabels?.(null);
  }, [dismiss, errorTitle, infoTitle, setLabels, successTitle]);
  return null;
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider");
  return toast;
}
