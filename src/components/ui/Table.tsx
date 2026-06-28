import { useMemo, type ReactNode } from "react";
import { cn } from "../../utils/cn";
import { EmptyState } from "./EmptyState";

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Render de la celda. Recibe la fila completa. */
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Oculta la columna en pantallas pequeñas. */
  hideOnMobile?: boolean;
  /** Habilita ordenar por esta columna (requiere sortValue). */
  sortable?: boolean;
  /** Valor usado para ordenar (número o texto). */
  sortValue?: (row: T) => number | string;
}

export interface SortState {
  key: string | null;
  dir: "asc" | "desc";
}

export interface SelectionConfig {
  selectedKeys: string[];
  onToggle: (key: string) => void;
  /** Recibe las keys actualmente visibles para seleccionar/deseleccionar todo. */
  onToggleAll: (keys: string[]) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  /** Resalta filas que cumplan la condición (ej. críticos). */
  rowClassName?: (row: T) => string | undefined;
  stickyHeader?: boolean;
  selection?: SelectionConfig;
  sort?: SortState;
  onSortChange?: (key: string) => void;
  /** Render de tarjeta para móvil. Si se define, en pantallas chicas se
   *  muestran tarjetas en vez de la tabla (más legible y táctil). */
  mobileCard?: (row: T) => ReactNode;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyMessage = "No hay datos para mostrar con los filtros actuales.",
  rowClassName,
  stickyHeader,
  selection,
  sort,
  onSortChange,
  mobileCard,
}: DataTableProps<T>) {
  const sortedData = useMemo(() => {
    if (!sort?.key) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), "es") * factor;
    });
  }, [data, sort, columns]);

  if (data.length === 0) {
    return (
      <div className="p-8">
        <EmptyState title="Sin resultados" description={emptyMessage} />
      </div>
    );
  }

  const visibleKeys = sortedData.map(rowKey);
  const allSelected =
    selection !== undefined &&
    visibleKeys.length > 0 &&
    visibleKeys.every((k) => selection.selectedKeys.includes(k));

  return (
    <>
      {/* Móvil: lista de tarjetas (más legible y táctil que una tabla ancha) */}
      {mobileCard && (
        <div className="lg:hidden divide-y divide-slate-100">
          {sortedData.map((row) => (
            <div
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={cn(
                "p-3.5",
                onRowClick &&
                  "cursor-pointer active:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-inset",
                rowClassName?.(row)
              )}
            >
              {mobileCard(row)}
            </div>
          ))}
        </div>
      )}

      <div className={cn("overflow-x-auto scrollbar-thin", mobileCard && "hidden lg:block")}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr
            className={cn(
              "border-b border-slate-200 bg-slate-50",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            {selection && (
              <th className="px-3 py-2.5 w-10">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-300 cursor-pointer"
                  checked={allSelected}
                  onChange={() => selection.onToggleAll(visibleKeys)}
                  aria-label="Seleccionar todo"
                />
              </th>
            )}
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              return (
                <th
                  key={col.key}
                  onClick={
                    col.sortable && onSortChange
                      ? () => onSortChange(col.key)
                      : undefined
                  }
                  className={cn(
                    "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap",
                    alignClass[col.align ?? "left"],
                    col.hideOnMobile && "hidden lg:table-cell",
                    col.sortable && "cursor-pointer select-none hover:text-slate-700",
                    col.className
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      col.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {col.header}
                    {col.sortable && (
                      <span className={cn("text-[10px]", isSorted ? "text-brand-600" : "text-slate-300")}>
                        {isSorted ? (sort?.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => {
            const key = rowKey(row);
            const selected = selection?.selectedKeys.includes(key);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        // Solo cuando el foco está en la fila misma, no en un
                        // control interno (botón, checkbox, enlace).
                        if (
                          (e.key === "Enter" || e.key === " ") &&
                          e.target === e.currentTarget
                        ) {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                role={onRowClick ? "button" : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  "border-b border-slate-100 transition-colors",
                  onRowClick &&
                    "cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-inset",
                  selected && "bg-brand-50/50",
                  rowClassName?.(row)
                )}
              >
                {selection && (
                  <td className="px-3 py-2 w-10" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-300 cursor-pointer"
                      checked={selected}
                      onChange={() => selection.onToggle(key)}
                      aria-label="Seleccionar fila"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-3 py-2 text-slate-700 align-middle",
                      alignClass[col.align ?? "left"],
                      col.hideOnMobile && "hidden lg:table-cell",
                      col.className
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
