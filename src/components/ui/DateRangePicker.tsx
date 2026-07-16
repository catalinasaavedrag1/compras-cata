import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { cn } from "../../utils/cn";
import { IconCalendar, IconChevronRight, IconClose } from "./icons";
import {
  DATE_PRESETS,
  activePresetKey,
  formatRangeLabel,
  isoToDate,
  dateToIso,
  type IsoRange,
} from "../../utils/dateRange";

interface DateRangePickerProps {
  value: IsoRange;
  onChange: (range: IsoRange) => void;
  label?: string;
  placeholder?: string;
  /** Alineación del popover respecto al disparador. */
  align?: "left" | "right";
  className?: string;
}

// Colores de marca para el calendario (react-day-picker usa variables CSS).
const RDP_STYLE: CSSProperties = {
  // @ts-expect-error -- variables CSS propias de react-day-picker
  "--rdp-accent-color": "#1f49d6",
  "--rdp-accent-background-color": "#eef4ff",
  "--rdp-range_middle-color": "#1b3bad",
  "--rdp-range_middle-background-color": "#d9e6ff",
  "--rdp-today-color": "#1f49d6",
  "--rdp-day-width": "2.25rem",
  "--rdp-day-height": "2.25rem",
  "--rdp-day_button-width": "2.25rem",
  "--rdp-day_button-height": "2.25rem",
  margin: 0,
};

/**
 * Selector de rango de fechas moderno: botón disparador + popover con atajos
 * de período (Hoy, Últimos 7/30 días, Este mes, Mes pasado, Este/Año pasado) y
 * un calendario de rango. Trabaja con strings ISO "aaaa-mm-dd".
 */
export function DateRangePicker({
  value,
  onChange,
  label,
  placeholder = "Todas las fechas",
  align = "left",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<IsoRange>(value);
  const [months, setMonths] = useState(1);
  const ref = useRef<HTMLDivElement>(null);

  // Dos meses en escritorio, uno en móvil.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setMonths(mq.matches ? 2 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Al abrir, el borrador parte del valor aplicado.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  // Cerrar por clic-fuera y Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasValue = !!(value.from || value.to);
  const triggerText = hasValue ? formatRangeLabel(value) : placeholder;
  const draftPreset = activePresetKey(draft);

  const selected = useMemo<DateRange | undefined>(() => {
    const from = isoToDate(draft.from);
    if (!from) return undefined;
    return { from, to: isoToDate(draft.to) };
  }, [draft]);

  const defaultMonth =
    isoToDate(draft.to) ?? isoToDate(draft.from) ?? isoToDate(value.to) ?? undefined;

  const apply = (r: IsoRange) => {
    onChange(r);
    setOpen(false);
  };
  const clear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange({ from: "", to: "" });
    setDraft({ from: "", to: "" });
    setOpen(false);
  };

  return (
    <div className={cn("w-full", className)} ref={ref}>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "w-full flex items-center gap-2 rounded-lg border bg-white py-2 pl-3 pr-9 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-100",
            open ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-300 hover:bg-slate-50",
            hasValue ? "text-slate-800" : "text-slate-400"
          )}
        >
          <IconCalendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="flex-1 truncate text-left">{triggerText}</span>
          {!hasValue && (
            <IconChevronRight
              className={cn(
                "absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform",
                open && "rotate-90"
              )}
            />
          )}
        </button>
        {/* Control de limpiar como botón hermano (no anidado dentro del trigger). */}
        {hasValue && (
          <button
            type="button"
            aria-label="Limpiar fechas"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <IconClose className="w-3.5 h-3.5" />
          </button>
        )}

        {open && (
          <div
            role="dialog"
            className={cn(
              "absolute z-50 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden",
              "flex flex-col sm:flex-row",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {/* Atajos de período */}
            <div className="flex sm:flex-col gap-1 p-2 sm:border-r border-slate-100 overflow-x-auto sm:overflow-visible sm:w-44 flex-shrink-0">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => apply(p.range())}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors flex-shrink-0",
                    draftPreset === p.key
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Calendario de rango */}
            <div className="p-2">
              <DayPicker
                mode="range"
                locale={es}
                numberOfMonths={months}
                defaultMonth={defaultMonth}
                selected={selected}
                onSelect={(r) => setDraft({ from: dateToIso(r?.from), to: dateToIso(r?.to) })}
                weekStartsOn={1}
                showOutsideDays
                style={RDP_STYLE}
              />
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 mt-1">
                <button
                  type="button"
                  onClick={() => clear()}
                  className="text-xs font-medium text-slate-500 hover:text-rose-600"
                >
                  Limpiar
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => apply(draft)}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
