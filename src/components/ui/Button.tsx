import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  loadingText?: string;
};

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  loading = false,
  loadingText,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button className={`button button-${variant} ${loading ? "button-loading" : ""} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <LoaderCircle className="button-spinner" size={18} aria-hidden="true" /> : icon}
      {children && <span>{loading && loadingText ? loadingText : children}</span>}
    </button>
  );
}
