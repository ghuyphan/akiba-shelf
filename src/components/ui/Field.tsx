import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

type FieldLabelProps = {
  children: ReactNode;
  className?: string;
};

export function FieldLabel({ children, className = "" }: FieldLabelProps) {
  return <span className={`field-label ${className}`}>{children}</span>;
}

export function Field({ label, hint, error, className = "", children }: FieldProps) {
  return (
    <label className={`field ${className}`}>
      <FieldLabel>{label}</FieldLabel>
      {children}
      {error ? (
        <span className="field-error-msg" role="alert">{error}</span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input textarea" {...props} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}
