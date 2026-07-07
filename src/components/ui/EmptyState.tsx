import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: ReactNode;
  meta?: string[];
  action?: ReactNode;
};

export function EmptyState({ title, message, icon, meta = [], action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
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
