import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  label?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

export function Input({ icon, label, className, id, inputRef, ...props }: InputProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-medium text-slate-600 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={inputRef}
          id={fieldId}
          className={cn(
            "w-full rounded-lg border border-slate-300 bg-white py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100",
            icon ? "pl-9 pr-3" : "px-3",
            className
          )}
          {...props}
        />
      </div>
    </div>
  );
}
