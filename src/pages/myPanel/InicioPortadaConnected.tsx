import { useMemo } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { IconAlerts, IconClock, IconTruck } from "../../components/ui/icons";
import { useDashboard } from "../../hooks/useDashboard";
import { useProposals } from "../../hooks/useProposals";
import type {
  DashboardAgendaSection,
  DashboardAlertsSection,
  DashboardApprovalsSection,
  DashboardBudgetSection,
  DashboardReplenishmentSection,
} from "../../services/purchaseBff";
import {
  formatCurrencyCompact,
  formatDate,
  formatDays,
  formatNumber,
} from "../../utils/formatters";
import {
  InicioPortada,
  type AgendaEntry,
  type PendingWork,
  type PortadaSummary,
} from "./InicioPortada";
import type { AgendaItem } from "./types";

// ============================================================================
//  Portada de Inicio conectada al dashboard real (flujo 6):
//  - Bandeja de decisiones prioritarias ← sections.replenishment.top.
//  - KPIs de la línea superior ← conteos del motor + presupuesto OTB.
//  - Agenda ← recepciones por llegar, OC con problema SAP y reclamos abiertos.
//  - Trabajo pendiente ← pendingCount del motor, propuestas en trabajo
//    (useProposals, flujo 2-3) y aprobaciones del dashboard (si hay permiso).
//  Los accesos a proveedores/señales siguen alimentados por mocks (flujos
//  posteriores) y llegan como conteos desde MyPanelPage.
// ============================================================================

interface InicioPortadaConnectedProps {
  /** Conteo mock de proveedores por revisar (flujo posterior). */
  suppliersToReviewCount: number;
  /** Conteo mock de señales de ventas (flujo posterior). */
  salesSignalsCount: number;
}

/** Urgencia, tono y orden por prioridad del motor de reposición. */
const PRIORITY_META: Record<string, { urgency: string; tone: AgendaItem["tone"] }> = {
  stockout_imminent: { urgency: "QUIEBRE INMINENTE", tone: "red" },
  low_stock: { urgency: "STOCK BAJO", tone: "amber" },
  opportunity: { urgency: "OPORTUNIDAD", tone: "blue" },
};

/** Días de hoy (real, no la fecha de la demo) a una fecha ISO. */
function daysFromToday(iso: string): number {
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isFinite(due.getTime())) return 0;
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function whenLabel(days: number): string {
  if (days < 0) return "vencida";
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  return `${days}d`;
}

/** Top del motor → tarjetas de "Prioridades del día" (el detalle vive en Decisiones). */
function toPriorities(replenishment: DashboardReplenishmentSection, asOf: string): AgendaItem[] {
  return replenishment.top.map((item, index) => {
    const meta = PRIORITY_META[item.priority] ?? { urgency: "PENDIENTE", tone: "blue" as const };
    return {
      id: item.recommendationId,
      dueDate: asOf.slice(0, 10),
      days: 0,
      kind: "Compra",
      urgency: meta.urgency,
      title: item.skuName ?? item.sku,
      meta: `SKU ${item.sku}`,
      impact:
        item.coverageDays !== null
          ? `Cobertura ${formatDays(item.coverageDays)}`
          : "Cobertura sin datos",
      recommendation:
        item.suggestedQty !== null
          ? `Recomendación: comprar ${formatNumber(item.suggestedQty)} u.`
          : "Recomendación: revisar en Decisiones",
      actionLabel: "Revisar compra",
      to: `/comprar/decisiones?q=${encodeURIComponent(item.sku)}`,
      tone: meta.tone,
      priority: 1000 - index,
      impactValue: 0,
    };
  });
}

interface AgendaView {
  entries: AgendaEntry[];
  /** Aviso cuando la sección completa vino degradada. */
  notice: string | null;
  /** Mensajes de sub-fuentes caídas (badge "Datos parciales"). */
  partial: string | null;
}

/** Sección agenda del BFF → entradas de "Tu agenda" + avisos de degradación. */
function toAgendaView(agenda: DashboardAgendaSection): AgendaView {
  if (agenda.status === "degraded") {
    return { entries: [], notice: agenda.warning.message, partial: null };
  }

  const entries: AgendaEntry[] = [];
  agenda.items.forEach((item, index) => {
    if (item.type === "reception_due") {
      const days = daysFromToday(item.dueDate);
      entries.push({
        id: `rec-${item.receptionId ?? index}`,
        icon: IconTruck,
        title: `Recepción ${item.refId ?? "por llegar"}`,
        detail: `${item.poNumber ? `De ${item.poNumber} · ` : ""}vence ${formatDate(item.dueDate.slice(0, 10))}`,
        when: whenLabel(days),
        tone: days < 0 ? "red" : days <= 1 ? "amber" : "blue",
        to: item.receptionId
          ? `/recepciones?rid=${encodeURIComponent(item.receptionId)}`
          : "/recepciones",
      });
    } else {
      entries.push({
        id: `sap-${item.purchaseOrderId ?? index}`,
        icon: IconAlerts,
        title: `${item.refId ?? "OC"} con problema de envío SAP`,
        detail: item.detail ?? "Revisa el envío en Seguimiento",
        when: "hoy",
        tone: "red",
        to: item.refId
          ? `/comprar/seguimiento?oc=${encodeURIComponent(item.refId)}`
          : "/comprar/seguimiento",
      });
    }
  });

  const claims = agenda.claimsOpenCount ?? 0;
  if (claims > 0) {
    entries.push({
      id: "claims-open",
      icon: IconClock,
      title: "Reclamos abiertos con proveedores",
      detail: claims === 1 ? "1 reclamo en curso o en revisión" : `${formatNumber(claims)} reclamos en curso o en revisión`,
      when: formatNumber(claims),
      tone: "amber",
      to: "/reclamos",
    });
  }

  const partial =
    agenda.warnings && agenda.warnings.length > 0
      ? agenda.warnings.map((w) => w.message).join(" ")
      : null;
  return { entries, notice: null, partial };
}

/** Línea OTB de los KPIs: dato real cuando la sección responde, aviso si no. */
function toOtbLabel(budget: DashboardBudgetSection): { label: string; muted: boolean } {
  if (budget.status === "degraded") {
    return { label: "OTB no disponible", muted: true };
  }
  const buckets = budget.items ?? [];
  if (buckets.length === 0) {
    return { label: "OTB sin configurar este mes", muted: true };
  }
  const totalClp = buckets.reduce((sum, bucket) => sum + (bucket.amountClp ?? 0), 0);
  const availableClp = buckets.reduce((sum, bucket) => sum + (bucket.availableClp ?? 0), 0);
  return {
    label: `OTB disponible ${formatCurrencyCompact(availableClp)} de ${formatCurrencyCompact(totalClp)}`,
    muted: false,
  };
}

/**
 * Entrada de alertas activas para "Trabajo pendiente" (sections.alerts, F7).
 * Sección degradable: sin dato se muestra "—" en vez de inventar un conteo.
 */
function toAlertsPending(alerts: DashboardAlertsSection): PendingWork {
  if (alerts.status === "degraded") {
    return {
      id: "alertas",
      label: "Alertas comerciales activas",
      detail: "No disponible por ahora",
      count: null,
      tone: "amber",
      to: "/alertas",
    };
  }
  const { critical, warning } = alerts.bySeverity;
  const detail =
    alerts.activeCount === 0
      ? "Sin alertas activas"
      : critical > 0
        ? `${formatNumber(critical)} de severidad alta`
        : warning > 0
          ? `${formatNumber(warning)} de severidad media`
          : "Solo informativas";
  return {
    id: "alertas",
    label: "Alertas comerciales activas",
    detail,
    count: alerts.activeCount,
    tone: critical > 0 ? "red" : "amber",
    to: "/alertas",
  };
}

/** Entrada de aprobaciones para "Trabajo pendiente" (solo si la sección viene). */
function toApprovalsPending(approvals: DashboardApprovalsSection): PendingWork {
  if (approvals.status === "degraded") {
    return {
      id: "aprobaciones",
      label: "Esperando aprobación",
      detail: "No disponible por ahora",
      count: null,
      tone: "amber",
      to: "/comprar/aprobaciones",
    };
  }
  return {
    id: "aprobaciones",
    label: "Esperando aprobación",
    detail: approvals.oldestAt
      ? `La más antigua espera desde ${formatDate(approvals.oldestAt.slice(0, 10))}`
      : "Sin solicitudes en espera",
    count: approvals.pendingCount,
    tone: "amber",
    to: "/comprar/aprobaciones",
  };
}

function PortadaSkeleton() {
  return (
    <section className="mb-4 space-y-4" aria-busy="true" aria-label="Cargando bandeja del día">
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
    </section>
  );
}

export function InicioPortadaConnected({
  suppliersToReviewCount,
  salesSignalsCount,
}: InicioPortadaConnectedProps) {
  const { data, loading, error, configured, refetch } = useDashboard();
  const { proposals, loading: proposalsLoading, error: proposalsError } = useProposals();

  const proposalsTotalClp = useMemo(
    () => proposals.reduce((sum, proposal) => sum + (proposal.netTotalClp ?? 0), 0),
    [proposals]
  );

  if (!configured) {
    return (
      <section className="mb-4">
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              conectar tu bandeja diaria con datos reales.
            </p>
          </div>
        </Card>
      </section>
    );
  }

  if (loading && !data) {
    return <PortadaSkeleton />;
  }

  if (error || !data) {
    return (
      <section className="mb-4">
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudo cargar tu bandeja del día
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {error?.message ?? "Error del servicio de compras."}
            </p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  const { replenishment, approvals, budget, agenda, alerts } = data.sections;

  const priorities = toPriorities(replenishment, data.asOf);
  const agendaView = toAgendaView(agenda);
  const otb = toOtbLabel(budget);

  const summary: PortadaSummary = {
    pendientes: replenishment.pendingCount,
    quiebres: replenishment.stockoutImminent,
    stockBajo: replenishment.lowStock,
    oportunidades: replenishment.opportunity,
    compraSugerida:
      replenishment.suggestedAmountClp !== null
        ? formatCurrencyCompact(replenishment.suggestedAmountClp)
        : null,
    otbLabel: otb.label,
    otbMuted: otb.muted,
  };

  const pending: PendingWork[] = [
    {
      id: "decisiones",
      label: "Decisiones de compra pendientes",
      detail: "Recomendaciones del motor por revisar",
      count: replenishment.pendingCount,
      tone: "red",
      to: "/comprar/decisiones",
    },
    {
      id: "borradores",
      label: "Propuestas en preparación",
      detail: proposalsError
        ? "No disponible por ahora"
        : proposalsTotalClp > 0
          ? `${formatCurrencyCompact(proposalsTotalClp)} en trabajo`
          : "Sin propuestas en preparación",
      count: proposalsError || proposalsLoading ? null : proposals.length,
      tone: "blue",
      to: "/comprar/borradores",
    },
    ...(approvals ? [toApprovalsPending(approvals)] : []),
    toAlertsPending(alerts),
    {
      id: "proveedores",
      label: "Proveedores por contactar",
      detail: "Bajo cumplimiento o sin respuesta",
      count: suppliersToReviewCount,
      tone: "amber",
      to: "/proveedores",
    },
    {
      id: "senales",
      label: "Señales de ventas por resolver",
      detail: "Reportes del equipo de ventas en tus categorías",
      count: salesSignalsCount,
      tone: "violet",
      to: "/senales-ventas",
    },
  ];

  return (
    <InicioPortada
      priorities={priorities}
      agenda={agendaView.entries}
      summary={summary}
      pending={pending}
      agendaNotice={agendaView.notice}
      agendaPartial={agendaView.partial}
    />
  );
}
