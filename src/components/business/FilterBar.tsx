import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { IconSearch } from "../ui/icons";
import { cn } from "../../utils/cn";

export interface SelectFilterConfig {
  key: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export interface ToggleFilterConfig {
  key: string;
  label: string;
  active: boolean;
  onToggle: () => void;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  selects?: SelectFilterConfig[];
  toggles?: ToggleFilterConfig[];
  onClear?: () => void;
  resultCount?: number;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  selects = [],
  toggles = [],
  onClear,
  resultCount,
}: FilterBarProps) {
  const hasActiveFilters =
    searchValue.trim() !== "" ||
    selects.some((s) => s.value !== "") ||
    toggles.some((t) => t.active);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card p-3 space-y-3">
      <div className="flex flex-col lg:flex-row gap-2.5">
        <div className="lg:w-72">
          <Input
            icon={<IconSearch className="w-4 h-4" />}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2">
          {selects.map((s) => (
            <div key={s.key} className="min-w-[140px] flex-1 lg:flex-none">
              <Select
                placeholder={s.placeholder}
                value={s.value}
                options={s.options}
                onChange={(e) => s.onChange(e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {(toggles.length > 0 || hasActiveFilters) && (
        <div className="flex items-center gap-2 flex-wrap">
          {toggles.map((t) => (
            <button
              key={t.key}
              onClick={t.onToggle}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                t.active
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              )}
            >
              {t.label}
            </button>
          ))}
          <div className="flex-1" />
          {resultCount !== undefined && (
            <span className="text-xs text-slate-500">
              {resultCount} resultado{resultCount === 1 ? "" : "s"}
            </span>
          )}
          {hasActiveFilters && onClear && (
            <button
              onClick={onClear}
              className="text-xs font-medium text-slate-500 hover:text-rose-600"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
