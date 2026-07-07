import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type AlertVariant = "info" | "success" | "error";

type AlertProps = {
  children: ReactNode;
  title?: string;
  variant?: AlertVariant;
  className?: string;
};

const icons = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
};

export function Alert({ children, title, variant = "info", className = "" }: AlertProps) {
  const Icon = icons[variant];

  return (
    <div className={`alert alert-${variant} ${className}`} role={variant === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" />
      <div className="alert-content">
        {title && <p className="alert-title">{title}</p>}
        <p className="alert-description">{children}</p>
      </div>
    </div>
  );
}
