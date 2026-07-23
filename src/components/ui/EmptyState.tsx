import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: ReactNode;
  meta?: string[];
  action?: ReactNode;
  variant?: "default" | "compact";
  tone?: "neutral" | "loading" | "error";
  className?: string;
};

export function EmptyState({ title, message, icon, meta = [], action, variant = "default", tone = "neutral", className = "" }: EmptyStateProps) {
  const resolvedIcon =
    icon ??
    (tone === "loading" ? (
      <LoaderCircle
        className="state-spinner"
        size={26}
        aria-hidden="true"
      />
    ) : undefined);

  return (
    <div className={`empty-state empty-state-${variant} empty-state-${tone} ${className}`.trim()} role={tone === "error" ? "alert" : "status"} aria-live="polite" aria-busy={tone === "loading" || undefined}>
      {resolvedIcon && <div className="empty-state-icon">{resolvedIcon}</div>}
      <div className="empty-state-copy">
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      {meta.length > 0 && (
        <div className="empty-state-meta">
          {meta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      )}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
