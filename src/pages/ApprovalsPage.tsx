import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { InfoHint } from "../components/business/InfoHint";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { PageSkeleton } from "../components/ui/Skeleton";
import { useToast } from "../context/ToastContext";
import {
  useApprovals,
  usePendingApprovalsCount,
  type UiApprovalState,
} from "../hooks/useApprovals";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import {
  criterionLabelEs,
  describePurchaseBffError,
  type ApprovalItem,
  type ProposalCriterion,
} from "../services/purchaseBff";
import { IconCheck, IconAlerts, IconOrders, IconLock } from "../components/ui/icons";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../utils/formatters";

const APPROVE_PERMISSION = "purchase:proposal:approve";

const STATE_META: Record<UiApprovalState, { label: string; tone: BadgeTone }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  observada: { label: "Observada", tone: "violet" },
  aprobada: { label: "Aprobada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
};

const STATE_FILTERS: UiApprovalState[] = ["pendiente", "observada", "aprobada", "rechazada"];

// ----------------------------------------------------------------------------
//  Cada aprobación llega aquí porque la propuesta rompió criterios de
//  gobernanza. Se muestra SOLO lo fuera de criterio: la regla rota
//  (threshold) y su magnitud real (actual).
// ----------------------------------------------------------------------------
interface Breach {
  dot: string;
  label: string;
  value: string;
  limit?: string;
  delta?: string;
}

function numField(obj: unknown, key: string): number | null {
  if (obj !== null && typeof obj === "object" && key in (obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function strField(obj: unknown, key: string): string | null {
  if (obj !== null && typeof obj === "object" && key in (obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function criterionBreach(c: ProposalCriterion): Breach {
  switch (c.code) {
    case "high_amount": {
      const actual = numField(c.actual, "amountClp");
      const limit = numField(c.threshold, "amountClp");
      const supplier = strField(c.actual, "supplierRef");
      return {
        dot: "bg-amber-500",
        label: supplier ? `${criterionLabelEs(c.code)} · ${supplier}` : criterionLabelEs(c.code),
        value: actual !== null ? formatCurrency(actual) : "—",
        limit: limit !== null ? `límite ${formatCurrency(limit)}` : undefined,
        delta:
          actual !== null && limit !== null ? `+${formatCurrency(actual - limit)}` : undefined,
      };
    }
    case "excessive_coverage": {
      const actual = numField(c.actual, "projectedCoverageDays");
      const limit = numField(c.threshold, "days");
      const sku = c.sku ?? strField(c.actual, "sku");
      return {
        dot: "bg-violet-500",
        label: sku ? `${criterionLabelEs(c.code)} · ${sku}` : criterionLabelEs(c.code),
        value: actual !== null ? `${formatNumber(Math.round(actual))} días` : "—",
        limit: limit !== null ? `objetivo ${formatNumber(limit)} días` : undefined,
        delta:
          actual !== null && limit !== null
            ? `+${formatNumber(Math.round(actual - limit))} d`
            : undefined,
      };
    }
    default:
      return { dot: "bg-slate-400", label: criterionLabelEs(c.code), value: "Fuera de criterio" };
  }
}

function uiState(a: ApprovalItem): UiApprovalState {
  switch (a.state) {
    case "approved":
      return "aprobada";
    case "rejected":
      return "rechazada";
    case "observed":
      return "observada";
    default:
      return "pendiente";
  }
}

export function ApprovalsPage() {
  const toast = useToast();
  const [filter, setFilter] = useState<UiApprovalState>("pendiente");
  const { items, meta, loading, error, configured, refetch, decide } = useApprovals(filter);
  const pendingCountBadge = usePendingApprovalsCount();
  const { context, hasPermission } = usePurchaseContext();
  const canApprove = hasPermission(APPROVE_PERMISSION);

  const [reasonTarget, setReasonTarget] = useState<{
    approval: ApprovalItem;
    action: "reject" | "request-changes";
  } | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const pageTitle = "Aprobaciones de compra";
  const pageDescription =
    "Propuestas enviadas a revisión que rompieron criterios de gobernanza (monto alto o cobertura excesiva). Aquí se aprueban, rechazan o devuelven con observaciones, dejando todo trazado.";

  const runDecision = async (
    approval: ApprovalItem,
    action: "approve" | "reject" | "request-changes",
    reason?: string
  ) => {
    setDecidingId(approval.id);
    const result = await decide(approval.id, action, approval.version, reason ? { reason } : {});
    setDecidingId(null);
    const name = approval.proposal?.title ?? `Propuesta ${approval.proposalId}`;
    if (result.ok) {
      if (action === "approve") toast.success(`${name}: aprobada`);
      else if (action === "reject") toast.warning(`${name}: rechazada`);
      else toast.info(`${name}: devuelta con observaciones al comprador`);
      setReasonTarget(null);
      return;
    }
    const info = result.error;
    if (info.code === "VERSION_CONFLICT" || info.code === "CONFLICT") {
      toast.warning("La aprobación cambió en el servidor; se recargó la bandeja");
    } else {
      toast.error(describePurchaseBffError(info));
    }
  };

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
              conectar la bandeja real de aprobaciones.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return <PageSkeleton />;
  }

  if (error && items.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las aprobaciones
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

  const inViewTotal = meta?.total ?? items.length;
  const pendingCount = filter === "pendiente" ? inViewTotal : pendingCountBadge;
  const amountInView = items.reduce((acc, a) => acc + (a.proposal?.netTotalClp ?? 0), 0);
  const highAmountCount = items.filter((a) =>
    (a.criteria ?? []).some((c) => c.code === "high_amount")
  ).length;

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        help={
          <InfoHint label="Cómo funcionan las aprobaciones">
            <p>
              Al <b>enviar a revisión</b> una propuesta, el servicio evalúa criterios de gobernanza:{" "}
              <b>monto alto</b> por proveedor y <b>cobertura excesiva</b> por SKU. Si alguno se
              rompe, la propuesta espera en esta bandeja.
            </p>
            <p>
              Decidir requiere el permiso <b>purchase:proposal:approve</b> y el autor de la
              propuesta no puede aprobar su propia solicitud.
            </p>
          </InfoHint>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="En bandeja"
          value={formatNumber(pendingCount)}
          tone={pendingCount > 0 ? "warn" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
        />
        <KpiCard
          title="Monto en vista"
          value={formatCurrencyCompact(amountInView)}
          tone="info"
          icon={<IconOrders className="w-4 h-4" />}
        />
        <KpiCard
          title="Con monto alto"
          value={formatNumber(highAmountCount)}
          tone={highAmountCount > 0 ? "warn" : "neutral"}
          icon={<IconOrders className="w-4 h-4" />}
        />
        <KpiCard
          title={`Total ${STATE_META[filter].label.toLowerCase()}s`}
          value={formatNumber(inViewTotal)}
          tone="neutral"
          icon={<IconCheck className="w-4 h-4" />}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-full ring-1 ring-inset ${filter === f ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
          >
            {STATE_META[f].label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title={
                filter === "pendiente" ? "Sin aprobaciones pendientes" : "Sin solicitudes"
              }
              description={
                filter === "pendiente"
                  ? "No hay propuestas esperando decisión. Las nuevas llegan al enviar un borrador a revisión."
                  : "No hay solicitudes en este estado."
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const state = uiState(a);
            const isOwn = context !== null && a.requestedByUserId === context.userId;
            const busy = decidingId === a.id;
            return (
              <Card key={a.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {a.proposal?.title ?? `Propuesta ${a.proposalId}`}
                        </p>
                        {state !== "pendiente" && (
                          <Badge tone={STATE_META[state].tone}>{STATE_META[state].label}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatDate(a.createdAt.slice(0, 10))} · solicitada por {a.requestedByUserId}
                        {a.proposal?.buyerId ? ` · comprador ${a.proposal.buyerId}` : ""}
                        {a.decidedByUserId ? ` · decidida por ${a.decidedByUserId}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatCurrency(a.proposal?.netTotalClp ?? 0)}
                      </p>
                      <p className="text-xs text-slate-400">neto propuesta</p>
                    </div>
                  </div>

                  {(a.criteria?.length ?? 0) > 0 && (
                    <div className="mb-3 rounded-lg border border-slate-200">
                      <p className="border-b border-slate-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Fuera de criterio
                      </p>
                      <div className="divide-y divide-slate-100">
                        {(a.criteria ?? []).map((c, idx) => {
                          const b = criterionBreach(c);
                          return (
                            <div
                              key={`${c.code}-${idx}`}
                              className="flex items-baseline justify-between gap-3 px-3 py-2"
                            >
                              <span className="flex items-center gap-2 text-sm text-slate-600">
                                <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
                                {b.label}
                              </span>
                              <span className="text-right text-sm text-slate-800">
                                <span className="font-semibold">{b.value}</span>
                                {b.limit && (
                                  <span className="font-normal text-slate-400"> vs {b.limit}</span>
                                )}
                                {b.delta && (
                                  <span className="ml-1.5 font-semibold text-amber-600">
                                    {b.delta}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {a.note && (
                    <p className="text-sm text-slate-700 mb-3">
                      <span className="text-slate-400">Nota:</span> {a.note}
                    </p>
                  )}

                  {a.reason && (
                    <div
                      className={`mb-3 rounded-lg border px-3 py-2 ${state === "observada" ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-slate-50"}`}
                    >
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide ${state === "observada" ? "text-violet-700" : "text-slate-500"}`}
                      >
                        {state === "observada" ? "Observación del aprobador" : "Motivo de la decisión"}
                      </p>
                      <p
                        className={`mt-0.5 text-sm ${state === "observada" ? "text-violet-900" : "text-slate-700"}`}
                      >
                        {a.reason}
                      </p>
                    </div>
                  )}

                  {state === "pendiente" &&
                    (canApprove ? (
                      <>
                        {isOwn && (
                          <p className="mb-2 text-xs text-amber-600">
                            Tú solicitaste esta propuesta: el servicio no permite decidir la propia
                            aprobación.
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => void runDecision(a, "approve")}
                            icon={<IconCheck className="w-4 h-4" />}
                          >
                            {busy ? "Guardando…" : "Aprobar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => setReasonTarget({ approval: a, action: "reject" })}
                          >
                            Rechazar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              setReasonTarget({ approval: a, action: "request-changes" })
                            }
                          >
                            Observar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        <IconLock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
                        <span>
                          Decidir requiere el permiso{" "}
                          <b className="text-slate-700">purchase:proposal:approve</b> en tu sesión.
                        </span>
                      </div>
                    ))}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {reasonTarget && (
        <ReasonModal
          approval={reasonTarget.approval}
          action={reasonTarget.action}
          busy={decidingId === reasonTarget.approval.id}
          onClose={() => setReasonTarget(null)}
          onSubmit={(reason) =>
            void runDecision(reasonTarget.approval, reasonTarget.action, reason)
          }
        />
      )}
    </div>
  );
}

function ReasonModal({
  approval,
  action,
  busy,
  onClose,
  onSubmit,
}: {
  approval: ApprovalItem;
  action: "reject" | "request-changes";
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const isReject = action === "reject";
  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={isReject ? "Rechazar propuesta" : "Devolver con observación"}
      description={approval.proposal?.title ?? `Propuesta ${approval.proposalId}`}
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          {isReject
            ? "La propuesta queda rechazada y el comprador deberá crear una nueva si corresponde."
            : "La propuesta vuelve al comprador con tu observación. Podrá ajustarla y reenviarla sin perder la traza."}
        </p>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Motivo <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder={
              isReject
                ? "Ej: El monto excede el presupuesto del trimestre; posterga la compra."
                : "Ej: La cobertura queda muy alta para esta rotación. Baja a ~60 días o justifica la temporada."
            }
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!trimmed || busy} onClick={() => onSubmit(trimmed)}>
            {busy ? "Guardando…" : isReject ? "Rechazar" : "Devolver con observación"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
