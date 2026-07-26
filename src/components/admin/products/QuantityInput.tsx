import { Minus, Plus } from "lucide-react";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { NumberInput } from "../../ui/NumberInput";

type QuantityInputProps = {
  value: number;
  disabled?: boolean;
  invalid?: boolean;
  onChange: (value: number) => void;
};

export function QuantityInput({
  value,
  disabled,
  invalid,
  onChange,
}: QuantityInputProps) {
  const { t } = usePlatformI18n();

  function step(amount: number) {
    const next = Math.max(0, value + amount);
    onChange(next);
  }

  return (
    <div className="admin-quantity-input">
      <div className="admin-quantity-control">
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => step(-1)}
          aria-label={t("Decrease quantity")}
        >
          <Minus size={17} />
        </button>
        <NumberInput
          min={0}
          placeholder="0"
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={onChange}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(1)}
          aria-label={t("Increase quantity")}
        >
          <Plus size={17} />
        </button>
      </div>
      {value >= 1_000 && (
        <small className="admin-quantity-warning">
          {t("Large quantity — double-check this number.")}
        </small>
      )}
    </div>
  );
}
