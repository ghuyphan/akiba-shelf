import type { InputHTMLAttributes } from "react";

type RangeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  value: number;
  min: number;
  max: number;
};

export function RangeInput({ value, min, max, className = "", style, ...props }: RangeInputProps) {
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <input
      {...props}
      type="range"
      min={min}
      max={max}
      value={value}
      className={`range-input ${className}`.trim()}
      style={{ ...style, "--range-progress": `${progress}%` } as React.CSSProperties}
    />
  );
}
