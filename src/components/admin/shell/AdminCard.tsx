import { type ReactNode, useId } from "react";

type AdminCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  variant?: "panel" | "inset" | "flush";
  density?: "default" | "compact";
  dataGuideSpotlight?: string;
  children: ReactNode;
};

export function AdminCard({
  title,
  description,
  action,
  icon,
  className = "",
  variant = "panel",
  density = "default",
  dataGuideSpotlight,
  children,
}: AdminCardProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      data-guide-spotlight={dataGuideSpotlight}
      className={`admin-card admin-card-${variant} admin-card-${density} ${className}`.trim()}
    >
      <div className="admin-card-header">
        <div className="admin-card-title">
          {icon && <span className="admin-card-icon">{icon}</span>}
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
        </div>
        {action && <div className="admin-card-header-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}
