import { useEffect, useState, type ChangeEvent } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { usePlatformI18n } from "../../lib/i18n/platformI18n";

type PasswordFieldProps = {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  disabled?: boolean;
  placeholder?: string;
  describedBy?: string;
};

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  disabled,
  placeholder,
  describedBy,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const { t } = usePlatformI18n();

  useEffect(() => {
    if (!value) setVisible(false);
  }, [value]);

  return (
    <label className="admin-login-field">
      <span>{label}</span>
      <div className="admin-login-input">
        <Lock size={19} className="input-icon" aria-hidden="true" />
        <input
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          aria-describedby={describedBy}
          onChange={onChange}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setVisible((current) => !current)}
          aria-label={t(visible ? "Hide {{label}}" : "Show {{label}}", { label: label.toLowerCase() })}
          disabled={disabled}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}
