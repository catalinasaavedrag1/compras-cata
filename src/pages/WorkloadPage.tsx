import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../context/ToastContext";
import { useSignals } from "../context/SignalsContext";
import { useCategoriesPanel } from "../hooks/useCategoriesPanel";
import {
  buyerInitials,
  buyerLabel,
  totalOpenItems,
  useReassignCategory,
  useTeamWorkload,
} from "../hooks/useTeam";
import {
  describePurchaseBffError,
  patchSignal,
  toPurchaseBffError,
  type BuyerWorkloadRow,
} from "../services/purchaseBff";
import { workloadBarColor } from "../utils/teamScore";
import { PILL_TONE } from "../utils/tone";
import { formatNumber } from "../utils/formatters";

// ============================================================================
//  Carga & reasignación (líder) conectada al purchase-bff-service (F15):
//  - La carga por comprador sale de los contadores reales de GET /team/workload.
//    La barra es RELATIVA: ítems abiertos del comprador / máximo del equipo
//    (no existe un "% de capacidad" en el contrato; no se inventa).
//  - "Solicitudes" siguen siendo las señales reales (F13) asignadas a cada
//    comprador; ahora matchean por buyerId real del workload.
//  - Reasignar categoría ejecuta el C18 real (useReassignCategory, con
//    reintento por 409); reasignar una solicitud usa PATCH /signals/:id
//    (assignedBuyerId, If-Match con la versión de la señal).
//  Los "proveedores reasignables" y el flujo "dar de baja y redistribuir" del
//  mock no tienen fuente ni comando en el contrato: se retiraron de la vista.
// ============================================================================

type ReassignKind = "categoría" | "solicitud";

const AVATAR_TONES = ["blue", "violet", "green", "amber", "red"];

interface ReassignState {
  kind: ReassignKind;
  /** Etiqueta visible del elemento a mover. */
  label: string;
  /** Id real: categoryId o signalId según el tipo. */
  id: string;
  /** Versión de la señal (If-Match); solo aplica a solicitudes. */
  version?: number;
  from: BuyerWorkloadRow;
}

/** Nivel visual según carga relativa (solo presentación de datos reales). */
function loadLevel(pct: number): { label: string; tone: BadgeTone } {
  if (pct >= 90) return { label: "Crítica", tone: "red" };
  if (pct >= 75) return { label: "Alta", tone: "amber" };
  if (pct >= 40) return { label: "Normal", tone: "green" };
  return { label: "Baja", tone: "blue" };
}

export function WorkloadPage() {
  const toast = useToast();
  const signalsCtx = useSignals();
  const { rows, loading, error, configured, refetch } = useTeamWorkload();
  const categoriesPanel = useCategoriesPanel();
  const reassignCategoryCmd = useReassignCategory();

  const [reassign, setReassign] = useState<ReassignState | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categoriesPanel.rows) map.set(c.categoryId, c.name);
    return map;
  }, [categoriesPanel.rows]);

  const board = useMemo(
    () => [...rows].sort((a, b) => totalOpenItems(b.counts) - totalOpenItems(a.counts)),
    [rows]
  );
  const maxOpen = useMemo(
    () => Math.max(1, ...rows.map((r) => totalOpenItems(r.counts))),
    [rows]
  );
  const relPct = (r: BuyerWorkloadRow) =>
    Math.round((totalOpenItems(r.counts) / maxOpen) * 100);

  // Señales reales vivas asignadas al comprador (por buyerId del workload).
  const requestsOf = (r: BuyerWorkloadRow) =>
    signalsCtx.signals
      .filter(
        (s) =>
          s.assignedBuyerId === r.buyerId && s.status !== "actioned" && s.status !== "dismissed"
      )
      .slice(0, 6);

  const pageTitle = "Carga & reasignación";
  const pageDescription =
    "La carga por comprador suma sus ítems abiertos reales (compras pendientes, propuestas, OC, recepciones, reclamos, alertas, señales y decisiones). Equilibra moviendo categorías o solicitudes.";

  // --------------------------------------------------------------------------
  //  Estados de conexión: sin configurar, cargando y error (patrón flujo 1).
  // --------------------------------------------------------------------------
  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver la carga real del equipo y reasignar la cartera.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <div
          className="grid grid-cols-1 xl:grid-cols-2 gap-3.5"
          aria-busy="true"
          aria-label="Cargando carga del equipo"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-16 w-full" />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar la carga del equipo
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const toneOf = (idx: number) => PILL_TONE[AVATAR_TONES[idx % AVATAR_TONES.length]];

  const doReassign = async (target: BuyerWorkloadRow) => {
    if (!reassign || saving) return;
    setSaving(true);
    if (reassign.kind === "categoría") {
      const result = await reassignCategoryCmd(reassign.id, { buyerId: target.buyerId });
      setSaving(false);
      if (result.ok) {
        toast.success(
          `Categoría “${reassign.label}” reasignada de ${buyerLabel(reassign.from)} a ${buyerLabel(target)}`
        );
        setReassign(null);
        refetch();
        categoriesPanel.refetch();
      } else {
        toast.error(describePurchaseBffError(result.error));
      }
      return;
    }
    // Solicitud = señal de venta real: PATCH /signals/:id con If-Match.
    try {
      await patchSignal(reassign.id, reassign.version ?? 0, {
        assignedBuyerId: target.buyerId,
      });
      toast.success(
        `Solicitud “${reassign.label}” reasignada de ${buyerLabel(reassign.from)} a ${buyerLabel(target)}`
      );
      setReassign(null);
      signalsCtx.refetch();
      refetch();
    } catch (err) {
      toast.error(describePurchaseBffError(toPurchaseBffError(err)));
      // Versión obsoleta u otra sesión: refrescar para reflejar la realidad.
      signalsCtx.refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      <Card className="mb-4">
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500">
            La barra muestra la carga relativa al comprador con más ítems abiertos del equipo.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
        {board.map((b, idx) => {
          const total = totalOpenItems(b.counts);
          const pct = relPct(b);
          const level = loadLevel(pct);
          const requests = requestsOf(b);
          const factors = [
            { label: "Categorías", value: String(b.categories.length) },
            { label: "Compras pend.", value: formatNumber(b.counts.recommendationsPending) },
            { label: "Críticas", value: formatNumber(b.counts.criticalPending) },
            { label: "Propuestas", value: formatNumber(b.counts.proposalsOpen) },
            { label: "OC abiertas", value: formatNumber(b.counts.ordersOpen) },
            { label: "Recepciones", value: formatNumber(b.counts.receptionsPending) },
            { label: "Reclamos", value: formatNumber(b.counts.claimsOpen) },
            { label: "Alertas", value: formatNumber(b.counts.alertsActive) },
            { label: "Señales", value: formatNumber(b.counts.signalsOpen) },
          ];
          return (
            <Card key={b.buyerId}>
              <CardBody>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${toneOf(idx)}`}
                  >
                    {buyerInitials(b)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {buyerLabel(b)}
                    </p>
                    {!b.active && <span className="text-[11px] text-slate-400">Inactivo</span>}
                  </div>
                  <Badge tone={level.tone}>
                    Carga {level.label} · {formatNumber(total)} ítems
                  </Badge>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3.5">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: workloadBarColor(pct) }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3.5">
                  {factors.map((f) => (
                    <div key={f.label} className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[15px] font-semibold text-slate-700">{f.value}</p>
                      <p className="text-[10.5px] text-slate-400">{f.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Reasignar a otro comprador
                </p>
                <div className="space-y-2">
                  <ReassignGroup
                    label="Categorías"
                    items={b.categories.map((c) => ({
                      id: c,
                      label: categoryNames.get(c) ?? c,
                    }))}
                    kind="categoría"
                    onPick={(item) =>
                      setReassign({ kind: "categoría", label: item.label, id: item.id, from: b })
                    }
                  />
                  <ReassignGroup
                    label="Solicitudes"
                    items={requests.map((s) => ({
                      id: s.id,
                      label: s.sku ?? s.kind,
                      version: s.version,
                    }))}
                    kind="solicitud"
                    onPick={(item) =>
                      setReassign({
                        kind: "solicitud",
                        label: item.label,
                        id: item.id,
                        version: item.version,
                        from: b,
                      })
                    }
                  />
                  {b.categories.length === 0 && requests.length === 0 && (
                    <p className="text-xs text-slate-400">Sin elementos reasignables ahora.</p>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Modal reasignar (categoría vía C18; solicitud vía PATCH de señales) */}
      <Modal
        open={!!reassign}
        onClose={() => (saving ? undefined : setReassign(null))}
        title={reassign ? `Reasignar ${reassign.kind}` : "Reasignar"}
        description={
          reassign
            ? `Mover ${reassign.kind} “${reassign.label}” desde ${buyerLabel(reassign.from)}. Elige el comprador de destino.`
            : ""
        }
      >
        {reassign && (
          <div className="space-y-3">
            {board
              .filter((t) => t.buyerId !== reassign.from.buyerId && t.active)
              .map((t) => {
                const pct = relPct(t);
                return (
                  <div key={t.buyerId} className="border border-slate-200 rounded-xl p-3.5">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${toneOf(board.findIndex((x) => x.buyerId === t.buyerId))}`}
                      >
                        {buyerInitials(t)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{buyerLabel(t)}</p>
                        <p className="text-xs text-slate-400">
                          Carga actual {loadLevel(pct).label} ·{" "}
                          {formatNumber(totalOpenItems(t.counts))} ítems abiertos
                        </p>
                      </div>
                      <Button size="sm" disabled={saving} onClick={() => void doReassign(t)}>
                        {saving ? "Asignando…" : "Asignar aquí"}
                      </Button>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2.5">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: workloadBarColor(pct) }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Modal>
    </div>
  );
}

interface ReassignItem {
  id: string;
  label: string;
  version?: number;
}

function ReassignGroup({
  label,
  items,
  kind,
  onPick,
}: {
  label: string;
  items: ReassignItem[];
  kind: ReassignKind;
  onPick: (item: ReassignItem) => void;
}) {
  if (items.length === 0) return null;
  const tone =
    kind === "categoría"
      ? "hover:border-brand-300 hover:bg-brand-50/40"
      : "hover:border-amber-300 hover:bg-amber-50/40";
  return (
    <div>
      <p className="text-[10.5px] text-slate-400 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onPick(it)}
            className={`inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 ${tone}`}
            title={`Reasignar ${kind}: ${it.label}`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
