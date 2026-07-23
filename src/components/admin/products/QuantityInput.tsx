import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatNumber } from "../../../utils/format";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { TextInput } from "../../ui/Field";

type QuantityInputProps = {
  value: number;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: number) => void;
};

function parseQuantity(value: string) {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isSafeInteger(parsed) ? Math.max(0, parsed) : 0;
}

export function QuantityInput({ value, disabled, invalid, onChange }: QuantityInputProps) {
  const [draft, setDraft] = useState(String(value));
  const { t } = usePlatformI18n();

  useEffect(() => {
    setDraft((current) => parseQuantity(current) === value ? current : String(value));
  }, [value]);

  function update(next: string) {
    const cleaned = next.replace(/\D/g, "");
    setDraft(cleaned);
    onChange(parseQuantity(cleaned));
  }

  function step(amount: number) {
    const next = Math.max(0, value + amount);
    setDraft(String(next));
    onChange(next);
  }

  return (
    <div className="admin-quantity-input">
      <div className="admin-quantity-control">
        <button type="button" disabled={disabled || value <= 0} onClick={() => step(-1)} aria-label={t("Decrease quantity")}><Minus size={17} /></button>
        <TextInput
          type="text"
          inputMode="numeric"
          placeholder="0"
          value={draft}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(event) => update(event.target.value)}
          onBlur={() => setDraft(String(value))}
          onFocus={(event) => event.currentTarget.select()}
        />
        <button type="button" disabled={disabled} onClick={() => step(1)} aria-label={t("Increase quantity")}><Plus size={17} /></button>
      </div>
      <output className={value >= 1_000 ? "is-warning" : ""}>
        {t("{{count}} items in stock", { count: formatNumber(value) })}
        {value >= 1_000 && <small>{t("Large quantity — double-check this number.")}</small>}
      </output>
    </div>
  );
}
