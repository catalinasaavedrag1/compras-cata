import { useState } from "react";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { DateRangePicker } from "../ui/DateRangePicker";
import { IconSearch, IconClose } from "../ui/icons";
import { cn } from "../../utils/cn";
import { formatRangeLabel, type IsoRange } from "../../utils/dateRange";

export interface DateRangeFilterConfig {
  value: IsoRange;
  onChange: (range: IsoRange) => void;
  /** Texto del disparador cuando no hay rango (ej. "Todas las fechas"). */
  label?: string;
}

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
  /** Filtro de rango de fechas (opcional): se muestra como selector moderno. */
  dateRange?: DateRangeFilterConfig;
  onClear?: () => void;
  resultCount?: number;
  /** Resumen compacto opcional (ej. "32 productos · 6 sin stock"). */
  summary?: string;
  /** Cuántos selects mostrar siempre en escritorio; el resto va en "Más filtros". */
  primaryCount?: number;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  selects = [],
  toggles = [],
  dateRange,
  onClear,
  resultCount,
  summary,
  primaryCount = 2,
}: FilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false); // escritorio
  const [sheetOpen, setSheetOpen] = useState(false); // móvil

  const primarySelects = selects.slice(0, primaryCount);
  const advancedSelects = selects.slice(primaryCount);
  const hasAdvanced = advancedSelects.length > 0 || toggles.length > 0;

  const activeSelects = selects.filter((s) => s.value !== "");
  const activeToggles = toggles.filter((t) => t.active);
  const dateActive = !!(dateRange && (dateRange.value.from || dateRange.value.to));
  const clearDate = () => dateRange?.onChange({ from: "", to: "" });
  const activeCount =
    (searchValue.trim() ? 1 : 0) +
    activeSelects.length +
    activeToggles.length +
    (dateActive ? 1 : 0);
  const activeFiltersOnly = activeSelects.length + activeToggles.length + (dateActive ? 1 : 0);
  const activeAdvanced =
    advancedSelects.filter((s) => s.value !== "").length + activeToggles.length;

  const optionLabel = (s: SelectFilterConfig) =>
    s.options.find((o) => o.value === s.value)?.label ?? s.value;

  const countText =
    summary ??
    (resultCount !== undefined
      ? `${resultCount} resultado${resultCount === 1 ? "" : "s"}${
          activeFiltersOnly > 0
            ? ` · ${activeFiltersOnly} filtro${activeFiltersOnly === 1 ? "" : "s"}`
            : ""
        }`
      : "");

  return (
    <>
      {/* ================= ESCRITORIO ================= */}
      <div className="hidden lg:block bg-white border border-slate-200 rounded-xl shadow-card p-3 space-y-3">
        <div className="flex gap-2.5">
          <div className="w-72">
            <Input
              icon={<IconSearch className="w-4 h-4" />}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          {dateRange && (
            <div className="w-60 flex-shrink-0">
              <DateRangePicker
                value={dateRange.value}
                onChange={dateRange.onChange}
                placeholder={dateRange.label ?? "Todas las fechas"}
              />
            </div>
          )}
          <div className="flex-1 flex flex-wrap gap-2">
            {primarySelects.map((s) => (
              <div key={s.key} className="w-44">
                <Select
                  placeholder={s.placeholder}
                  aria-label={s.placeholder}
                  value={s.value}
                  options={s.options}
                  onChange={(e) => s.onChange(e.target.value)}
                />
              </div>
            ))}
          </div>
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
                <span className="ml-1.5 rounded-full bg-brand-600 text-white text-xs px-1.5">
                  {activeAdvanced}
                </span>
              )}
            </button>
          )}
        </div>

        {showAdvanced && hasAdvanced && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            {advancedSelects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {advancedSelects.map((s) => (
                  <div key={s.key} className="w-44">
                    <Select
                      placeholder={s.placeholder}
                      aria-label={s.placeholder}
                      value={s.value}
                      options={s.options}
                      onChange={(e) => s.onChange(e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
            {toggles.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {toggles.map((t) => (
                  <Chip key={t.key} active={t.active} onClick={t.onToggle}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}

        {(dateActive || activeSelects.length > 0 || activeToggles.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap border-t border-slate-100 pt-2.5">
            {dateActive && dateRange && (
              <ActiveChip onRemove={clearDate}>{formatRangeLabel(dateRange.value)}</ActiveChip>
            )}
            {activeSelects.map((s) => (
              <ActiveChip key={s.key} onRemove={() => s.onChange("")}>
                {s.placeholder}: {optionLabel(s)}
              </ActiveChip>
            ))}
            {activeToggles.map((t) => (
              <ActiveChip key={t.key} onRemove={t.onToggle}>
                {t.label}
              </ActiveChip>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {countText && <span className="text-xs text-slate-500">{countText}</span>}
          <div className="flex-1" />
          {activeCount > 0 && onClear && (
            <button
              onClick={onClear}
              className="text-xs font-medium text-slate-500 hover:text-rose-600"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* ================= MÓVIL ================= */}
      <div className="lg:hidden space-y-2">
        <Input
          icon={<IconSearch className="w-4 h-4" />}
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        {dateRange && (
          <DateRangePicker
            value={dateRange.value}
            onChange={dateRange.onChange}
            placeholder={dateRange.label ?? "Todas las fechas"}
          />
        )}

        {/* Chips rápidos en una línea con scroll horizontal */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
          {toggles.map((t) => (
            <Chip key={t.key} active={t.active} onClick={t.onToggle} nowrap>
              {t.label}
            </Chip>
          ))}
          {(selects.length > 0 || toggles.length > 0) && (
            <button
              onClick={() => setSheetOpen(true)}
              className={cn(
                "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium flex-shrink-0",
                activeFiltersOnly > 0
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-300 text-slate-600"
              )}
            >
              Más filtros
              {activeFiltersOnly > 0 && (
                <span className="ml-1 rounded-full bg-brand-600 text-white text-[10px] px-1.5">
                  {activeFiltersOnly}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Chips de filtros activos (removibles) */}
        {(dateActive || activeSelects.length > 0 || activeToggles.length > 0) && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-0.5">
            {dateActive && dateRange && (
              <ActiveChip onRemove={clearDate}>{formatRangeLabel(dateRange.value)}</ActiveChip>
            )}
            {activeSelects.map((s) => (
              <ActiveChip key={s.key} onRemove={() => s.onChange("")}>
                {s.placeholder}: {optionLabel(s)}
              </ActiveChip>
            ))}
            {activeToggles.map((t) => (
              <ActiveChip key={t.key} onRemove={t.onToggle}>
                {t.label}
              </ActiveChip>
            ))}
            {activeFiltersOnly > 1 && onClear && (
              <button
                onClick={onClear}
                className="whitespace-nowrap text-xs font-medium text-rose-600 flex-shrink-0 px-1"
              >
                Limpiar todo
              </button>
            )}
          </div>
        )}

        {countText && <p className="text-xs text-slate-500 px-0.5">{countText}</p>}
      </div>

      {/* Bottom sheet de filtros avanzados (móvil) */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={`Filtros${activeFiltersOnly > 0 ? ` · ${activeFiltersOnly} aplicado${activeFiltersOnly === 1 ? "" : "s"}` : ""}`}
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => onClear?.()}>
              Limpiar
            </Button>
            <Button className="flex-1" onClick={() => setSheetOpen(false)}>
              Ver{" "}
              {resultCount !== undefined
                ? `${resultCount} resultado${resultCount === 1 ? "" : "s"}`
                : "resultados"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {selects.map((s) => (
            <div key={s.key}>
              <p className="text-xs font-medium text-slate-600 mb-1">{s.placeholder}</p>
              <Select
                placeholder={`Todos`}
                aria-label={s.placeholder}
                value={s.value}
                options={s.options}
                onChange={(e) => s.onChange(e.target.value)}
              />
            </div>
          ))}
          {toggles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1.5">Filtros rápidos</p>
              <div className="flex flex-wrap gap-2">
                {toggles.map((t) => (
                  <Chip key={t.key} active={t.active} onClick={t.onToggle}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
  nowrap,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  nowrap?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
        nowrap && "whitespace-nowrap flex-shrink-0",
        active
          ? "bg-brand-600 text-white border-brand-600"
          : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function ActiveChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0 rounded-full bg-brand-50 border border-brand-200 text-brand-700 pl-2.5 pr-1.5 py-1 text-xs font-medium">
      {children}
      <button
        onClick={onRemove}
        className="rounded-full hover:bg-brand-100 p-0.5"
        aria-label="Quitar filtro"
      >
        <IconClose className="w-3 h-3" />
      </button>
    </span>
  );
}
