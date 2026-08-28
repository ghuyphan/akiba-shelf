type StyleOption<Value extends string> = readonly [
  value: Value,
  label: string,
  description: string,
];

type DesignerStyleOptionsProps<Value extends string> = {
  options: readonly StyleOption<Value>[];
  value: Value;
  className?: string;
  sampleClassName: (value: Value) => string;
  sampleStyle?: (value: Value) => React.CSSProperties | undefined;
  translate: (value: string) => string;
  onChange: (value: Value) => void;
};

export function DesignerStyleOptions<Value extends string>({
  options,
  value,
  className = "designer-card-style-grid designer-section-style-grid",
  sampleClassName,
  sampleStyle,
  translate,
  onChange,
}: DesignerStyleOptionsProps<Value>) {
  return (
    <div className={className}>
      {options.map(([optionValue, label, description]) => (
        <button
          key={optionValue}
          type="button"
          className={value === optionValue ? "active" : ""}
          onClick={() => onChange(optionValue)}
          aria-pressed={value === optionValue}
          aria-label={`${translate(label)}: ${translate(description)}`}
        >
          <i
            className={sampleClassName(optionValue)}
            style={sampleStyle?.(optionValue)}
            aria-hidden="true"
          />
          <span>
            <strong>{translate(label)}</strong>
            <small>{translate(description)}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
