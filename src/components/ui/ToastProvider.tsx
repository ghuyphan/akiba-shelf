import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { safeUuid } from "../../lib/id";

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

const ToastContext = createContext<ToastApi | null>(null);
const icons = { info: Info, success: CheckCircle2, error: AlertCircle };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [exitingIds, setExitingIds] = useState<string[]>([]);
  const timersRef = useRef(new Map<string, number>());

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) window.clearTimeout(timer);
    timersRef.current.delete(id);
    setExitingIds((prev) => prev.includes(id) ? prev : [...prev, id]);
    const exitTimer = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
      setExitingIds((prev) => prev.filter((x) => x !== id));
      timersRef.current.delete(id);
    }, 280);
    timersRef.current.set(id, exitTimer);
  }, []);

  const show = useCallback((input: ToastInput) => {
    const id = safeUuid();
    const toast: ToastItem = { ...input, id, variant: input.variant ?? "info" };
    setToasts((current) => {
      const duplicateIds = current
        .filter((item) => item.variant === toast.variant && item.title === toast.title && item.message === toast.message)
        .map((item) => item.id);
      duplicateIds.forEach((duplicateId) => {
        const timer = timersRef.current.get(duplicateId);
        if (timer) window.clearTimeout(timer);
        timersRef.current.delete(duplicateId);
      });
      const next = [...current.filter((item) => !duplicateIds.includes(item.id)), toast];
      const evicted = next.slice(0, -3);
      evicted.forEach((item) => {
        const timer = timersRef.current.get(item.id);
        if (timer) window.clearTimeout(timer);
        timersRef.current.delete(item.id);
      });
      return next.slice(-3);
    });
    const duration = input.duration ?? (toast.variant === "error" ? 6500 : 4000);
    const timer = window.setTimeout(() => dismiss(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    show,
    info: (message, title) => show({ message, title, variant: "info" }),
    success: (message, title) => show({ message, title, variant: "success" }),
    error: (message, title) => show({ message, title, variant: "error" }),
    dismiss,
  }), [dismiss, show]);

  return <ToastContext.Provider value={api}>{children}{createPortal(
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
          <div><strong>{toast.title ?? (toast.variant === "success" ? "Done" : toast.variant === "error" ? "Something went wrong" : "Notice")}</strong><p>{toast.message}</p></div>
          <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X size={14} /></button>
          <span className="toast-life" aria-hidden="true" />
        </div>;
      })}
    </div>, document.body)}</ToastContext.Provider>;
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider");
  return toast;
}
