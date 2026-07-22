import type { HTMLAttributes, ReactNode } from "react";

export type StatusPillTone =
  | "neutral"
  | "pending"
  | "success"
  | "danger"
  | "warning"
  | "info";

type StatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusPillTone;
  icon?: ReactNode;
};

export function StatusPill({
  tone = "neutral",
  icon,
  children,
  className = "",
  ...props
}: StatusPillProps) {
  return (
    <span
      className={`status-pill status-pill-${tone} ${className}`.trim()}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
