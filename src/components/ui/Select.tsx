import { useId, type SelectHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

interface Option {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  placeholder?: string;
}

export function Select({
  label,
  options,
  placeholder,
  className,
  id,
  ...props
}: SelectProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600 mb-1">
          {label}
        </label>
      )}
      <select
        id={fieldId}
        className={cn(
          "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100",
          className
        )}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
