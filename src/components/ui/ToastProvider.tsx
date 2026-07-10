import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { safeUuid } from "../../lib/supabase";

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
  const dismiss = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const show = useCallback((input: ToastInput) => {
    const id = safeUuid();
    const toast: ToastItem = { ...input, id, variant: input.variant ?? "info" };
    setToasts((current) => [...current.slice(-3), toast]);
    window.setTimeout(() => dismiss(id), input.duration ?? (toast.variant === "error" ? 6500 : 4000));
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
        return <div key={toast.id} className={`toast toast-${toast.variant}`} role={toast.variant === "error" ? "alert" : "status"}>
          <span className="toast-icon"><Icon size={17} /></span>
          <div><strong>{toast.title ?? (toast.variant === "success" ? "Done" : toast.variant === "error" ? "Something went wrong" : "Notice")}</strong><p>{toast.message}</p></div>
          <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(toast.id)}><X size={14} /></button>
        </div>;
      })}
    </div>, document.body)}</ToastContext.Provider>;
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider");
  return toast;
}
