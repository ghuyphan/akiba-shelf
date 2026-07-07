import type { ReactNode } from "react";

type AdminCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function AdminCard({ title, description, action, className = "", children }: AdminCardProps) {
  return (
    <section className={`admin-card ${className}`}>
      <div className="admin-card-header">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
