import { useState } from "react";
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
  /** Cuántos selects mostrar siempre; el resto va en "Más filtros". */
  primaryCount?: number;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  selects = [],
  toggles = [],
  onClear,
  resultCount,
  primaryCount = 2,
}: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const primarySelects = selects.slice(0, primaryCount);
  const advancedSelects = selects.slice(primaryCount);
  const hasAdvanced = advancedSelects.length > 0 || toggles.length > 0;

  const activeCount =
    (searchValue.trim() ? 1 : 0) +
    selects.filter((s) => s.value !== "").length +
    toggles.filter((t) => t.active).length;
  const activeAdvanced =
    advancedSelects.filter((s) => s.value !== "").length + toggles.filter((t) => t.active).length;

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
          {primarySelects.map((s) => (
            <div key={s.key} className="min-w-[140px] flex-1 lg:flex-none">
              <Select placeholder={s.placeholder} value={s.value} options={s.options} onChange={(e) => s.onChange(e.target.value)} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {hasAdvanced && (
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className={cn(
                "whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                showAdvanced || activeAdvanced > 0
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              )}
            >
              {showAdvanced ? "Ocultar filtros" : "Más filtros"}
              {activeAdvanced > 0 && (
                <span className="ml-1.5 rounded-full bg-brand-600 text-white text-xs px-1.5">{activeAdvanced}</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Área avanzada colapsable */}
      {showAdvanced && hasAdvanced && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          {advancedSelects.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-wrap gap-2">
              {advancedSelects.map((s) => (
                <div key={s.key} className="min-w-[140px] flex-1 lg:flex-none lg:w-44">
                  <Select placeholder={s.placeholder} value={s.value} options={s.options} onChange={(e) => s.onChange(e.target.value)} />
                </div>
              ))}
            </div>
          )}
          {toggles.length > 0 && (
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
            </div>
          )}
        </div>
      )}

      {/* Pie: contador + limpiar */}
      <div className="flex items-center gap-2 flex-wrap pt-0.5">
        {resultCount !== undefined && (
          <span className="text-xs text-slate-500">
            {resultCount} resultado{resultCount === 1 ? "" : "s"}
            {activeCount > 0 && ` · ${activeCount} filtro${activeCount === 1 ? "" : "s"} activo${activeCount === 1 ? "" : "s"}`}
          </span>
        )}
        <div className="flex-1" />
        {activeCount > 0 && onClear && (
          <button onClick={onClear} className="text-xs font-medium text-slate-500 hover:text-rose-600">
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
