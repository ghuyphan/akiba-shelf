import type { ReactNode } from "react";

type AdminEditStatusTone = "saved" | "dirty" | "saving" | "neutral";

type AdminEditBarProps = {
  status: ReactNode;
  statusTone?: AdminEditStatusTone;
  className?: string;
  children: ReactNode;
};

export function AdminEditBar({
  status,
  statusTone = "neutral",
  className = "",
  children,
}: AdminEditBarProps) {
  return (
    <div className={`admin-sticky-actions admin-edit-bar ${className}`}>
      <span className={`admin-edit-status is-${statusTone}`} aria-live="polite">
        <i aria-hidden="true" />
        {status}
      </span>
      <div className="admin-edit-actions">{children}</div>
    </div>
  );
}
