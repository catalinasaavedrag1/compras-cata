import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, CardHeader } from "../../components/ui/Card";
import { DataTable, type Column } from "../../components/ui/Table";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Modal } from "../../components/ui/Modal";
import { EmptyState } from "../../components/ui/EmptyState";
import type { SeasonPlanView, SeasonScenario, SeasonView } from "../../services/purchaseBff";
import {
  hasPlanContent,
  planCategoryRows,
  planForScenario,
  planTotalClp,
  plannedCategoryCount,
  type PlanCategoryRow,
} from "../../utils/seasonPlan";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatNumber,
  formatPercent,
} from "../../utils/formatters";
import { cn } from "../../utils/cn";
import { SCENARIO_META, SCENARIO_ORDER } from "./constants";

// ============================================================================
//  Piezas de presentación del planner sobre los datos reales (F18): plan por
//  escenario en CLP por categoría y comprometido real desde tracking. Las
//  piezas del plan mock por producto (fórmula, riesgo, evolución semanal)
//  se eliminaron: no tienen fuente en el contrato.
// ============================================================================

export function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
        {n}
      </span>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

export function HeaderField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold",
          highlight ? "text-rose-600" : "text-slate-800"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const color =
    tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-base font-semibold", color)}>{value}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Comparador de escenarios (base / optimista / conservador)
// ----------------------------------------------------------------------------

export function ScenarioComparator({
  season,
  active,
  onSelect,
}: {
  season: SeasonView;
  active: SeasonScenario;
  onSelect: (s: SeasonScenario) => void;
}) {
  return (
    <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
      {SCENARIO_ORDER.map((key) => {
        const view = planForScenario(season, key);
        const meta = SCENARIO_META[key];
        const isActive = key === active;
        const withPlan = hasPlanContent(view);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              isActive
                ? "border-brand-400 bg-brand-50/50 ring-1 ring-brand-200"
                : "border-slate-200 bg-white hover:border-brand-200"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
              {isActive && <Badge tone="blue">Activo</Badge>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
            {withPlan ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <ScStat label="Plan" value={formatCurrencyCompact(planTotalClp(view))} />
                <ScStat label="Categorías" value={formatNumber(plannedCategoryCount(view))} />
                <ScStat
                  label="Comprometido"
                  value={
                    view?.tracking ? formatCurrencyCompact(view.tracking.totalCommittedClp) : "—"
                  }
                />
                <ScStat
                  label="Actualizado"
                  value={view ? formatDate(view.dateModified.slice(0, 10)) : "—"}
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Sin plan todavía: selecciónalo y usa “Editar plan”.
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ScStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn("font-semibold", warn ? "text-rose-600" : "text-slate-800")}>{value}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Tabla plan vs comprometido por categoría
// ----------------------------------------------------------------------------

export function PlanCategoryTable({
  view,
  categoryName,
  onOpenRow,
}: {
  view: SeasonPlanView | null;
  categoryName: (id: string) => string;
  onOpenRow?: (row: PlanCategoryRow) => void;
}) {
  const rows = planCategoryRows(view);

  const columns: Column<PlanCategoryRow>[] = [
    {
      key: "category",
      header: "Categoría",
      render: (r) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-slate-800">{categoryName(r.categoryId)}</p>
          {categoryName(r.categoryId) !== r.categoryId && (
            <p className="text-xs text-slate-400">{r.categoryId}</p>
          )}
        </div>
      ),
    },
    {
      key: "planned",
      header: "Plan (CLP)",
      align: "right",
      render: (r) =>
        r.plannedClp !== null ? (
          <span className="font-semibold text-slate-900">{formatCurrency(r.plannedClp)}</span>
        ) : (
          <span className="text-slate-400" title="Categoría con OC pero sin monto planificado">
            —
          </span>
        ),
    },
    {
      key: "committed",
      header: "Comprometido real",
      align: "right",
      render: (r) =>
        r.committedClp !== null ? (
          <span className="text-slate-800">{formatCurrency(r.committedClp)}</span>
        ) : (
          <span className="text-slate-400" title="Aún sin tracking para esta categoría">
            —
          </span>
        ),
    },
    {
      key: "advance",
      header: "Avance",
      align: "right",
      hideOnMobile: true,
      render: (r) => {
        if (r.plannedClp === null || r.plannedClp <= 0 || r.committedClp === null) {
          return <span className="text-slate-400">—</span>;
        }
        const pct = (r.committedClp / r.plannedClp) * 100;
        return (
          <Badge tone={pct > 100 ? "red" : pct >= 70 ? "amber" : "green"}>
            {formatPercent(pct, 0)}
          </Badge>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.categoryId}
      onRowClick={onOpenRow}
      emptyMessage="Este escenario aún no tiene categorías planificadas."
      mobileCard={(r) => (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-slate-800">{categoryName(r.categoryId)}</p>
            <p className="text-xs text-slate-400">
              Comprometido {r.committedClp !== null ? formatCurrency(r.committedClp) : "—"}
            </p>
          </div>
          <p className="font-semibold text-slate-900">
            {r.plannedClp !== null ? formatCurrencyCompact(r.plannedClp) : "—"}
          </p>
        </div>
      )}
    />
  );
}

// ----------------------------------------------------------------------------
//  Seguimiento: comprometido real calculado desde las OC (tracking)
// ----------------------------------------------------------------------------

export function SeasonTrackingView({
  view,
  categoryName,
}: {
  view: SeasonPlanView | null;
  categoryName: (id: string) => string;
}) {
  const tracking = view?.tracking ?? null;

  if (!tracking) {
    return (
      <Card>
        <EmptyState
          title="Aún sin tracking"
          description="El comprometido real se calcula desde las órdenes de compra emitidas dentro de la ventana de compra de la temporada. Cuando existan OC en esa ventana, aparecerá aquí."
        />
      </Card>
    );
  }

  const planned = planTotalClp(view);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat
          label="Comprometido total"
          value={formatCurrencyCompact(tracking.totalCommittedClp)}
        />
        <MiniStat label="Órdenes de compra" value={formatNumber(tracking.orderCount)} />
        <MiniStat label="Plan del escenario" value={planned > 0 ? formatCurrencyCompact(planned) : "—"} />
        <MiniStat label="Calculado el" value={formatDate(tracking.computedAt.slice(0, 10))} />
      </div>
      <Card>
        <CardHeader
          title="Comprometido por categoría"
          description="Montos CLP reales de OC dentro de la ventana de compra, comparados con el plan del escenario activo"
        />
        <PlanCategoryTable view={view} categoryName={categoryName} />
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------------------
//  Editor del plan por escenario (PUT /seasons/:id/plans/:scenario)
// ----------------------------------------------------------------------------

interface EditorRow {
  categoryId: string;
  amount: string;
}

export function PlanEditorModal({
  open,
  onClose,
  scenario,
  view,
  categoryOptions,
  categoryName,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  scenario: SeasonScenario;
  view: SeasonPlanView | null;
  /** Categorías reales disponibles para agregar (panel de categorías). */
  categoryOptions: { value: string; label: string }[];
  categoryName: (id: string) => string;
  /** Devuelve true si el PUT quedó guardado (cierra el modal). */
  onSave: (plan: NonNullable<SeasonPlanView["plan"]>) => Promise<boolean>;
}) {
  const [rows, setRows] = useState<EditorRow[]>([]);
  const [notes, setNotes] = useState("");
  const [addId, setAddId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const byCategory = view?.plan?.byCategory ?? {};
    setRows(
      Object.entries(byCategory).map(([categoryId, c]) => ({
        categoryId,
        amount: c.plannedClp !== undefined ? String(c.plannedClp) : "",
      }))
    );
    setNotes(view?.plan?.notes ?? "");
    setAddId("");
    setError("");
    setSaving(false);
  }, [open, view]);

  const usedIds = useMemo(() => new Set(rows.map((r) => r.categoryId)), [rows]);
  const availableOptions = categoryOptions.filter((o) => !usedIds.has(o.value));

  const addRow = () => {
    const id = addId.trim();
    if (!id || usedIds.has(id)) return;
    setRows((prev) => [...prev, { categoryId: id, amount: "" }]);
    setAddId("");
  };

  const save = async () => {
    const byCategory: Record<string, { plannedClp?: number }> = {};
    for (const r of rows) {
      const amount = Number(r.amount);
      if (r.amount.trim() === "" || !Number.isFinite(amount) || amount < 0) {
        setError(`Indica un monto CLP válido para ${categoryName(r.categoryId)}.`);
        return;
      }
      byCategory[r.categoryId] = { plannedClp: Math.round(amount) };
    }
    setError("");
    setSaving(true);
    const ok = await onSave({ byCategory, notes: notes.trim() || undefined });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Plan ${SCENARIO_META[scenario].label.toLowerCase()}`}
      description="Presupuesto planificado por categoría (CLP) para la temporada. Se guarda en el servicio de compras con control de versión."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Guardar plan"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aún no hay categorías en este escenario. Agrega una para empezar a planificar.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.categoryId} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {categoryName(r.categoryId)}
                  </p>
                  {categoryName(r.categoryId) !== r.categoryId && (
                    <p className="truncate text-xs text-slate-400">{r.categoryId}</p>
                  )}
                </div>
                <div className="w-40 flex-shrink-0">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={r.amount}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((row) =>
                          row.categoryId === r.categoryId
                            ? { ...row, amount: e.target.value }
                            : row
                        )
                      )
                    }
                    aria-label={`Monto planificado para ${categoryName(r.categoryId)}`}
                    placeholder="CLP"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => prev.filter((row) => row.categoryId !== r.categoryId))
                  }
                  className="text-xs font-medium text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 border-t border-slate-100 pt-3">
          {availableOptions.length > 0 ? (
            <label className="block flex-1 text-xs text-slate-500">
              Agregar categoría
              <Select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                options={[{ value: "", label: "Selecciona una categoría…" }, ...availableOptions]}
              />
            </label>
          ) : (
            <label className="block flex-1 text-xs text-slate-500">
              Agregar categoría (ID)
              <Input
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                placeholder="ID de la categoría"
              />
            </label>
          )}
          <Button variant="secondary" size="sm" onClick={addRow} disabled={!addId.trim()}>
            Agregar
          </Button>
        </div>

        <label className="block text-xs text-slate-500">
          Notas del plan
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={2000}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Supuestos del escenario, acuerdos con proveedores, riesgos…"
          />
        </label>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
//  Ajuste de pronóstico auditado (POST /seasons/forecast-adjustments)
// ----------------------------------------------------------------------------

export function ForecastAdjustmentModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** Devuelve true si el ajuste quedó registrado (cierra el modal). */
  onSave: (body: { sku: string; adjustmentPct: number; reason: string }) => Promise<boolean>;
}) {
  const [sku, setSku] = useState("");
  const [pct, setPct] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSku("");
    setPct("");
    setReason("");
    setError("");
    setSaving(false);
  }, [open]);

  const save = async () => {
    const cleanSku = sku.trim();
    const value = Number(pct);
    const cleanReason = reason.trim();
    if (!cleanSku) {
      setError("Indica el SKU al que aplica el ajuste.");
      return;
    }
    if (pct.trim() === "" || !Number.isFinite(value) || value < -100 || value > 500) {
      setError("El ajuste debe ser un porcentaje entre -100 y 500.");
      return;
    }
    if (cleanReason.length < 5) {
      setError("El motivo es obligatorio (mínimo 5 caracteres): queda en la bitácora.");
      return;
    }
    setError("");
    setSaving(true);
    const ok = await onSave({ sku: cleanSku, adjustmentPct: value, reason: cleanReason });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo ajuste de pronóstico"
      description="Ajuste porcentual por SKU con motivo auditado. Queda registrado en el servicio de compras para esta temporada."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Guardando…" : "Registrar ajuste"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">
            SKU
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Ej. FER-00123"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Ajuste (%)
            <Input
              type="number"
              min={-100}
              max={500}
              step={1}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
              placeholder="Ej. 25 = +25%"
            />
          </label>
        </div>
        <label className="block text-xs text-slate-500">
          Motivo del ajuste
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Ej. licitación confirmada, evento local, quiebre reciente…"
          />
        </label>
      </div>
    </Modal>
  );
}
