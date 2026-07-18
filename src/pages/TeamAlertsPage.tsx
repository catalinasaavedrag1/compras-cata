import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import {
  ALERT_REF_ENTITY_LABEL,
  alertRefLink,
  alertTypeUi,
} from "../components/business/alertBff";
import { buyerLabel, useBuyerAlerts, useTeamWorkload } from "../hooks/useTeam";
import type { AlertSeverityBff } from "../services/purchaseBff";
import { formatDate } from "../utils/formatters";
import { IconArrowRight } from "../components/ui/icons";

// ============================================================================
//  Alertas del equipo (líder) conectadas al purchase-bff-service:
//  - Selector de comprador desde GET /team/workload (F15).
//  - Lista real de GET /alerts?status=active&buyerId=… (F7); los KPIs de
//    severidad se calculan sobre las filas recibidas.
//  Las alertas "de gestión" del mock (sobrecarga, metas, sin responsable) no
//  existen en el contrato: aquí se muestran las alertas comerciales reales del
//  motor, atribuidas al comprador responsable.
// ============================================================================

const SEV: Record<AlertSeverityBff, { label: string; tone: "red" | "amber" | "slate"; accent: string }> = {
  critical: { label: "Alta", tone: "red", accent: "#f43f5e" },
  warning: { label: "Media", tone: "amber", accent: "#f59e0b" },
  info: { label: "Baja", tone: "slate", accent: "#94a3b8" },
};

const SEVERITY_RANK: Record<AlertSeverityBff, number> = { critical: 0, warning: 1, info: 2 };

export function TeamAlertsPage() {
  const workload = useTeamWorkload();
  const [buyerId, setBuyerId] = useState("");
  const { alerts, loading, error, configured, refetch } = useBuyerAlerts(buyerId || null);

  const buyerName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of workload.rows) map.set(r.buyerId, buyerLabel(r));
    return map;
  }, [workload.rows]);

  const list = useMemo(
    () =>
      [...alerts].sort((a, b) => {
        const bySev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
        if (bySev !== 0) return bySev;
        return (a.dateCreated ?? "") < (b.dateCreated ?? "") ? 1 : -1;
      }),
    [alerts]
  );
  const count = (s: AlertSeverityBff) => alerts.filter((a) => a.severity === s).length;

  const pageTitle = "Alertas del equipo";
  const pageDescription =
    "Las alertas activas del motor comercial, vistas por comprador. Filtra para revisar la situación de cada cartera.";

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
              ver las alertas reales del equipo.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const selector = (
    <div className="max-w-xs mb-4">
      <Select
        label="Comprador"
        placeholder={
          workload.loading ? "Cargando compradores…" : "Todos los compradores"
        }
        value={buyerId}
        onChange={(e) => setBuyerId(e.target.value)}
        options={workload.rows.map((r) => ({ value: r.buyerId, label: buyerLabel(r) }))}
      />
    </div>
  );

  if (loading && alerts.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        {selector}
        <div className="space-y-3" aria-busy="true" aria-label="Cargando alertas del equipo">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 flex gap-4 items-start">
              <Skeleton className="self-stretch w-1 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error && alerts.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        {selector}
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las alertas
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

  return (
    <div>
      <PageHeader title={pageTitle} description={pageDescription} />

      {selector}

      {/* KPIs de severidad calculados sobre las filas reales */}
      <div className="flex flex-wrap gap-2.5 mb-4">
        <Badge tone="red" dot>
          {count("critical")} de alta prioridad
        </Badge>
        <Badge tone="amber" dot>
          {count("warning")} media
        </Badge>
        <Badge tone="slate" dot>
          {count("info")} baja
        </Badge>
      </div>

      {list.length === 0 ? (
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Sin alertas activas</p>
            <p className="mt-1 text-sm text-slate-500">
              {buyerId
                ? `${buyerName.get(buyerId) ?? buyerId} no tiene alertas activas ahora.`
                : "El equipo no tiene alertas activas ahora."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const sev = SEV[a.severity];
            const type = alertTypeUi(a.type);
            const link = alertRefLink(a.refEntity, a.refId);
            return (
              <Card key={a.id} className="p-4 flex gap-4 items-start">
                <div
                  className="self-stretch w-1 rounded-full flex-shrink-0"
                  style={{ background: sev.accent }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <Badge tone={sev.tone}>Severidad {sev.label}</Badge>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {type.group}
                    </span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs font-medium text-slate-500">
                      {a.buyerId ? (buyerName.get(a.buyerId) ?? a.buyerId) : "Área"}
                    </span>
                    {a.dateCreated && (
                      <>
                        <span className="text-xs text-slate-300">·</span>
                        <span className="text-xs text-slate-400">
                          {formatDate(a.dateCreated.slice(0, 10))}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-[15px] font-semibold text-slate-800">{a.title}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-snug">
                    {type.label} · {ALERT_REF_ENTITY_LABEL[a.refEntity] ?? a.refEntity}{" "}
                    <span className="text-slate-400">{a.refId}</span>
                  </p>
                </div>
                {link && (
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                      Acción
                    </span>
                    <Link to={link.to}>
                      <Button size="sm" icon={<IconArrowRight className="w-3.5 h-3.5" />}>
                        {link.label}
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
