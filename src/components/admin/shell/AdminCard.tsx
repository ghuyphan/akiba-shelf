import type { ReactNode } from "react";

type AdminCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function AdminCard({ title, description, action, icon, className = "", children }: AdminCardProps) {
  return (
    <section className={`admin-card ${className}`}>
      <div className="admin-card-header">
        <div className="admin-card-title">
          {icon && <span className="admin-card-icon">{icon}</span>}
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
        </div>
        {action && <div className="admin-card-header-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}
