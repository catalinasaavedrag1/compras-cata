import { useState } from "react";
import { Link } from "react-router-dom";
import { supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { InfoHint } from "../components/business/InfoHint";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../context/ToastContext";
import { usePurchaseFlow, type ApprovalState } from "../context/PurchaseFlowContext";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import type { ApprovalRequest, ApprovalCriterion } from "../data/mockApprovals";
import { CRITERION_LABEL } from "../data/mockApprovals";
import { IconCheck, IconAlerts, IconOrders, IconLock } from "../components/ui/icons";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../utils/formatters";

type Decision = ApprovalState;

const STATE_META: Record<ApprovalState, { label: string; tone: BadgeTone }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  en_analisis: { label: "En análisis", tone: "blue" },
  observada: { label: "Observada", tone: "violet" },
  aprobada: { label: "Aprobada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
};

// Estados que aún esperan una decisión del líder (bandeja activa).
const OPEN_STATES: ApprovalState[] = ["pendiente", "en_analisis", "observada"];

// ----------------------------------------------------------------------------
//  Cada solicitud llega aquí porque rompió una o más reglas. En vez de mostrar
//  todos los indicadores por igual, mostramos SOLO lo que se salió de criterio,
//  uniendo la regla rota con su magnitud: "por qué está aquí" + "cuánto se pasó".
// ----------------------------------------------------------------------------
type DeltaTone = "bad" | "warn" | "info";
interface Breach {
  dot: string; // color del punto (severidad de la regla)
  value: string; // valor solicitado / observado
  limit?: string; // límite o referencia contra la que se compara
  delta?: string; // cuánto se pasó
  deltaTone?: DeltaTone;
}

const DELTA_CLASS: Record<DeltaTone, string> = {
  bad: "text-rose-600",
  warn: "text-amber-600",
  info: "text-violet-600",
};

function criterionBreach(r: ApprovalRequest, c: ApprovalCriterion): Breach {
  switch (c) {
    case "desvio_sugerido": {
      if (r.suggestedQty === 0)
        return {
          dot: "bg-violet-500",
          value: `${formatNumber(r.requestedQty)} u.`,
          limit: "no estaba sugerida",
          delta: "compra nueva",
          deltaTone: "warn",
        };
      const pct = Math.round(((r.requestedQty - r.suggestedQty) / r.suggestedQty) * 100);
      return {
        dot: "bg-violet-500",
        value: `${formatNumber(r.requestedQty)} u.`,
        limit: `sugerido ${formatNumber(r.suggestedQty)} u.`,
        delta: `${pct > 0 ? "+" : ""}${pct}%`,
        deltaTone: "info",
      };
    }
    case "cobertura_excesiva": {
      const d = r.coberturaResultante - r.coberturaObjetivo;
      return {
        dot: "bg-violet-500",
        value: `${formatNumber(r.coberturaResultante)} d`,
        limit: `objetivo ${formatNumber(r.coberturaObjetivo)} d`,
        delta: `${d > 0 ? "+" : ""}${formatNumber(d)} d`,
        deltaTone: "warn",
      };
    }
    case "margen_bajo": {
      const d = r.margin - r.minMargin;
      return {
        dot: "bg-rose-500",
        value: `${formatNumber(r.margin)}%`,
        limit: `mín. ${formatNumber(r.minMargin)}%`,
        delta: `${d > 0 ? "+" : ""}${formatNumber(d)} pts`,
        deltaTone: "bad",
      };
    }
    case "monto_alto":
      return { dot: "bg-amber-500", value: formatCurrency(r.amount), limit: "sobre tu alzada" };
    case "proveedor_revision":
      return { dot: "bg-amber-500", value: "Desempeño en revisión", limit: r.supplierName };
    case "fuera_temporada":
      return { dot: "bg-amber-500", value: "Fuera de la ventana de temporada" };
    case "producto_nuevo":
      return { dot: "bg-blue-500", value: "Alta de producto nuevo" };
  }
}

export function ApprovalsPage() {
  const toast = useToast();
  const { approvals, approvalState, observations, setApprovalState } = usePurchaseFlow();
  const { buyer } = useBuyer();
  const { role } = useRole();
  const [filter, setFilter] = useState<Decision | "todas">("pendiente");
  const [observeTarget, setObserveTarget] = useState<ApprovalRequest | null>(null);

  // Flujo de roles explícito: el comprador solicita, el líder aprueba.
  const canApprove = role === "lider";

  // Un comprador solo ve y gestiona SUS aprobaciones; el líder, las de todo el equipo.
  const approvalRequests =
    role === "lider" ? approvals : approvals.filter((r) => r.buyerName === buyer);

  const stateOf = (id: string): Decision => approvalState[id] ?? "pendiente";
  const decide = (id: string, d: Decision, name: string) => {
    setApprovalState(id, d);
    if (d === "aprobada") toast.success(`${name}: aprobada`);
    else if (d === "rechazada") toast.warning(`${name}: rechazada`);
    else if (d === "en_analisis") toast.info(`${name}: puesta en análisis`);
    else toast.info(`${name}: reabierta`);
  };
  const submitObservation = (note: string) => {
    if (!observeTarget) return;
    setApprovalState(observeTarget.id, "observada", note);
    toast.info(`${observeTarget.productName}: devuelta con observación`);
    setObserveTarget(null);
  };

  const pendientes = approvalRequests.filter((r) => OPEN_STATES.includes(stateOf(r.id)));
  const montoPendiente = pendientes.reduce((a, r) => a + r.amount, 0);
  const aprobadas = approvalRequests.filter((r) => stateOf(r.id) === "aprobada").length;

  const filtered = approvalRequests.filter((r) =>
    filter === "todas" ? true : stateOf(r.id) === filter
  );
  const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

  return (
    <div>
      <PageHeader
        title="Aprobaciones de compra"
        description="Compras que se salen de criterio (monto, cobertura, margen, proveedor o muy distintas al sugerido). El comprador justifica el desvío; aquí se aprueba o rechaza, dejando todo trazado."
        help={
          <InfoHint label="Cómo funcionan las aprobaciones">
            <p>
              No todo lo que se sale del rango es malo: un descuento por volumen o una compra de
              temporada pueden justificarlo. Pero <b>debe quedar trazado</b> el{" "}
              <b>sugerido vs lo solicitado</b> y el <b>motivo</b>. Eso alimenta el historial de
              decisiones.
            </p>
            <p>
              Flujo de roles: el <b>comprador solicita</b> y el <b>líder aprueba</b> — cambia el rol
              arriba a la derecha para habilitar las acciones.
            </p>
          </InfoHint>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="En bandeja"
          value={formatNumber(pendientes.length)}
          tone={pendientes.length > 0 ? "warn" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Monto en aprobación"
          value={formatCurrencyCompact(montoPendiente)}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
        />
        <KpiCard
          title="Aprobadas"
          value={formatNumber(aprobadas)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
        />
        <KpiCard
          title="Total solicitudes"
          value={formatNumber(approvalRequests.length)}
          tone="neutral"
          icon={<IconOrders className="w-4 h-4" />}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(["pendiente", "en_analisis", "observada", "aprobada", "rechazada", "todas"] as const).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm px-3 py-1.5 rounded-full ring-1 ring-inset ${filter === f ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
            >
              {f === "todas" ? "Todas" : STATE_META[f].label}
            </button>
          )
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState title="Sin solicitudes" description="No hay solicitudes en este estado." />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const state = stateOf(r.id);
            return (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link
                          to={`/productos/${r.sku}`}
                          className="text-sm font-semibold text-slate-900 hover:text-brand-700 truncate"
                        >
                          {r.productName}
                        </Link>
                        {state !== "pendiente" && (
                          <Badge tone={STATE_META[state].tone}>{STATE_META[state].label}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {fmtDate(r.date)} · {r.buyerName} ·{" "}
                        <Link
                          to={supplierPath(r.supplierName)}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {r.supplierName}
                        </Link>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatCurrency(r.amount)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatNumber(r.requestedQty)} u. · {formatCurrency(r.unitCost)}/u
                      </p>
                    </div>
                  </div>

                  <div className="mb-3 rounded-lg border border-slate-200">
                    <p className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Fuera de criterio
                    </p>
                    <div className="divide-y divide-slate-100">
                      {r.criteria.map((c) => {
                        const b = criterionBreach(r, c);
                        return (
                          <div
                            key={c}
                            className="flex items-baseline justify-between gap-3 px-3 py-2"
                          >
                            <span className="flex items-center gap-2 text-sm text-slate-600">
                              <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
                              {CRITERION_LABEL[c]}
                            </span>
                            <span className="text-right text-sm text-slate-800">
                              <span className="font-semibold">{b.value}</span>
                              {b.limit && (
                                <span className="font-normal text-slate-400"> vs {b.limit}</span>
                              )}
                              {b.delta && (
                                <span
                                  className={`ml-1.5 font-semibold ${b.deltaTone ? DELTA_CLASS[b.deltaTone] : "text-slate-500"}`}
                                >
                                  {b.delta}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 mb-3">
                    <span className="text-slate-400">Justificación del comprador:</span>{" "}
                    {r.justification}
                  </p>

                  {observations[r.id] && (state === "observada" || OPEN_STATES.includes(state)) && (
                    <div className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                        Observación del líder
                      </p>
                      <p className="mt-0.5 text-sm text-violet-900">{observations[r.id]}</p>
                      {state === "observada" && r.buyerName === buyer && (
                        <p className="mt-1 text-xs text-violet-600">
                          Ajusta la solicitud según la observación y vuelve a enviarla.
                        </p>
                      )}
                    </div>
                  )}

                  {OPEN_STATES.includes(state) ? (
                    canApprove ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => decide(r.id, "aprobada", r.productName)}
                          icon={<IconCheck className="w-4 h-4" />}
                        >
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => decide(r.id, "rechazada", r.productName)}
                        >
                          Rechazar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setObserveTarget(r)}>
                          Observar
                        </Button>
                        {state !== "en_analisis" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => decide(r.id, "en_analisis", r.productName)}
                          >
                            Poner en análisis
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        <IconLock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                        <span>
                          {r.buyerName === buyer ? "Tú solicitaste esta compra. " : ""}
                          La aprobación requiere rol <b className="text-slate-700">Líder</b> —
                          cámbialo arriba a la derecha para aprobar, rechazar u observar.
                        </span>
                      </div>
                    )
                  ) : canApprove ? (
                    <button
                      onClick={() => decide(r.id, "pendiente", r.productName)}
                      className="text-xs font-medium text-slate-400 hover:text-slate-600"
                    >
                      Revertir a pendiente
                    </button>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {observeTarget && (
        <ObserveModal
          request={observeTarget}
          initial={observations[observeTarget.id] ?? ""}
          onClose={() => setObserveTarget(null)}
          onSubmit={submitObservation}
        />
      )}
    </div>
  );
}

function ObserveModal({
  request,
  initial,
  onClose,
  onSubmit,
}: {
  request: ApprovalRequest;
  initial: string;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState(initial);
  const trimmed = note.trim();
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title="Devolver con observación"
      description={`${request.productName} · ${request.buyerName}`}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          La solicitud vuelve al comprador con tu observación. Podrá ajustarla y reenviarla sin
          perder la traza del desvío.
        </p>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            ¿Qué debe ajustar? <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Ej: La cobertura queda muy alta para esta rotación. Baja a ~60 días o justifica la temporada."
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!trimmed} onClick={() => onSubmit(trimmed)}>
            Devolver con observación
          </Button>
        </div>
      </div>
    </Modal>
  );
}
