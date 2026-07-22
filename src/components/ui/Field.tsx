import {
  createContext,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useContext,
  useId,
} from "react";

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
  id?: string;
};

const FieldDescriptionContext = createContext<{
  describedBy?: string;
  labelledBy?: string;
  invalid: boolean;
}>({ invalid: false });

export function FieldLabel({ children, className = "", id }: FieldLabelProps) {
  return <span className={`field-label ${className}`} id={id}>{children}</span>;
}

export function Field({ label, hint, error, className = "", children }: FieldProps) {
  const labelId = useId();
  const descriptionId = useId();
  const describedBy = error || hint ? descriptionId : undefined;
  return (
    <label className={`field ${className}`}>
      <FieldLabel id={labelId}>{label}</FieldLabel>
      <FieldDescriptionContext.Provider
        value={{ describedBy, labelledBy: labelId, invalid: Boolean(error) }}
      >
        {children}
      </FieldDescriptionContext.Provider>
      {error ? (
        <span className="field-error-msg" id={descriptionId} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className="field-hint" id={descriptionId}>
            {hint}
          </span>
        )
      )}
    </label>
  );
}

export function TextInput({
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const field = useContext(FieldDescriptionContext);
  return (
    <input
      className="input"
      aria-describedby={ariaDescribedBy ?? field.describedBy}
      aria-labelledby={ariaLabelledBy ?? field.labelledBy}
      aria-invalid={(ariaInvalid ?? field.invalid) || undefined}
      {...props}
    />
  );
}

export function TextArea({
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const field = useContext(FieldDescriptionContext);
  return (
    <textarea
      className="input textarea"
      aria-describedby={ariaDescribedBy ?? field.describedBy}
      aria-labelledby={ariaLabelledBy ?? field.labelledBy}
      aria-invalid={(ariaInvalid ?? field.invalid) || undefined}
      {...props}
    />
  );
}

export function SelectInput({
  className = "",
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const field = useContext(FieldDescriptionContext);
  return (
    <select
      className={`input ${className}`.trim()}
      aria-describedby={ariaDescribedBy ?? field.describedBy}
      aria-labelledby={ariaLabelledBy ?? field.labelledBy}
      aria-invalid={(ariaInvalid ?? field.invalid) || undefined}
      {...props}
    />
  );
}
