import {
  SelectMenu,
  type SelectMenuOption,
} from "../../ui/SelectMenu";

export function DropdownField({
  label,
  value,
  options,
  onChange,
  disabled,
  className = "",
}: {
  label: string;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`field ${disabled ? "is-disabled" : ""} ${className}`.trim()}
    >
      <span className="field-label">{label}</span>
      <SelectMenu
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
