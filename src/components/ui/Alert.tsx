import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type AlertVariant = "info" | "success" | "error";

type AlertProps = {
  children: ReactNode;
  title?: string;
  variant?: AlertVariant;
  className?: string;
  onClose?: () => void;
  closeLabel?: string;
};

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function Alert({ children, title, variant = "info", className = "", onClose, closeLabel = "Dismiss notification" }: AlertProps) {
  const Icon = icons[variant];

  return (
    <div
      className={`alert alert-${variant} ${onClose ? "alert-dismissible" : ""} ${className}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon size={18} aria-hidden="true" />
      <div className="alert-content">
        {title && <p className="alert-title">{title}</p>}
        <p className="alert-description">{children}</p>
      </div>
      {onClose && (
        <button className="alert-close" type="button" aria-label={closeLabel} onClick={onClose}>
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );

}
