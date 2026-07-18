import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar } from "../components/business/FilterBar";
import { inRange, type IsoRange } from "../utils/dateRange";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Card, CardBody } from "../components/ui/Card";
import { Drawer } from "../components/ui/Drawer";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { SeverityBadge } from "../components/business/PriorityBadge";
import {
  ALERT_REF_ENTITY_LABEL,
  ALERT_SEVERITY_TO_UI,
  ALERT_STATUS_UI,
  alertRefLink,
  alertTypeUi,
  describeAlertConflict,
  isLiveAlert,
} from "../components/business/alertBff";
import { useAlerts } from "../hooks/useAlerts";
import { useToast } from "../context/ToastContext";
import { formatDate, formatNumber } from "../utils/formatters";
import { cn } from "../utils/cn";
import { IconAlerts, IconCheck } from "../components/ui/icons";
import {
  describePurchaseBffError,
  type AlertActionBff,
  type AlertSeverityBff,
  type AlertView,
} from "../services/purchaseBff";

// ============================================================================
//  Alertas (flujo 7) conectadas al purchase-bff-service. El mapeo de la
//  máquina real (active → acknowledged → resolved | dismissed) y de las
//  severidades (critical/warning/info → badges Alta/Media/Baja existentes)
//  vive en components/business/alertBff.ts. Pestañas sobre estados reales:
//    "Abiertas"    = active | acknowledged (la alerta sigue viva)
//    "Sin atender" = active · "Atendidas" = acknowledged
//    "Resueltas" / "Descartadas" = terminales (descartar exige motivo).
//  Acciones C17 idempotentes (todos los roles tienen purchase:alert:ack).
// ============================================================================

const TABS = [
  { value: "live", label: "Abiertas" },
  { value: "active", label: "Sin atender" },
  { value: "acknowledged", label: "Atendidas" },
  { value: "resolved", label: "Resueltas" },
  { value: "dismissed", label: "Descartadas" },
];

const SEVERITY_RANK: Record<AlertSeverityBff, number> = { critical: 0, warning: 1, info: 2 };

const PAGE_TITLE = "Alertas comerciales";
const PAGE_DESCRIPTION = "Problemas que requieren tu atención, con acción sugerida.";

function inTab(alert: AlertView, tab: string): boolean {
  if (tab === "live") return isLiveAlert(alert.status);
  return alert.status === tab;
}

export function AlertsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { alerts, loading, error, configured, refetch, applyAction } = useAlerts();

  const [tab, setTab] = useState("live");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [dates, setDates] = useState<IsoRange>({ from: "", to: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [dismissing, setDismissing] = useState<AlertView | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filtrado por la barra (sin la pestaña): controla KPIs y conteos.
  const byFilters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      if (severity && a.severity !== severity) return false;
      if (type && a.type !== type) return false;
      if (!inRange(a.dateCreated?.slice(0, 10) ?? "", dates)) return false;
      if (q.length === 0) return true;
      return [a.title, a.refId, a.ruleKey, alertTypeUi(a.type).label]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [alerts, query, type, severity, dates]);

  // Tipos disponibles para el filtro: los presentes en el inbox real.
  const typeOptions = useMemo(() => {
    const present = Array.from(new Set(alerts.map((a) => a.type)));
    return present
      .map((value) => ({ value, label: alertTypeUi(value).label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [alerts]);

  const counts = useMemo(
    () => ({
      live: byFilters.filter((a) => isLiveAlert(a.status)).length,
      active: byFilters.filter((a) => a.status === "active").length,
      acknowledged: byFilters.filter((a) => a.status === "acknowledged").length,
      resolved: byFilters.filter((a) => a.status === "resolved").length,
      dismissed: byFilters.filter((a) => a.status === "dismissed").length,
    }),
    [byFilters]
  );

  const criticalCount = useMemo(
    () => byFilters.filter((a) => a.severity === "critical" && isLiveAlert(a.status)).length,
    [byFilters]
  );

  const filtered = useMemo(() => {
    return byFilters
      .filter((a) => inTab(a, tab))
      .sort(
        (a, b) =>
          SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
          (b.dateCreated ?? "").localeCompare(a.dateCreated ?? "")
      );
  }, [byFilters, tab]);

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0];

  const runAction = async (alert: AlertView, action: AlertActionBff, reason?: string) => {
    setBusyId(alert.id);
    const result = await applyAction(alert.id, action, reason);
    setBusyId(null);
    if (result.ok) {
      if (action === "acknowledge") toast.success("Alerta marcada como atendida");
      else if (action === "resolve") toast.success("Alerta resuelta");
      else toast.success("Alerta descartada");
      setDismissing(null);
      return;
    }
    const info = result.error;
    if (info.code === "CONFLICT") {
      // Transición inválida (otra sesión o auto-resolve del motor): la lista ya se recarga.
      toast.warning(describeAlertConflict(info) ?? describePurchaseBffError(info));
      setDismissing(null);
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
        <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              ver las alertas reales y gestionarlas contra el servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && alerts.length === 0) {
    return (
      <div>
        <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando alertas">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && alerts.length === 0) {
    return (
      <div>
        <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />
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
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />

      {/* Filtros arriba: controlan KPIs, conteos y listado */}
      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por título, referencia o tipo"
          resultCount={byFilters.length}
          summary={`${byFilters.length} alerta${byFilters.length === 1 ? "" : "s"} · ${criticalCount} de severidad alta · ${counts.acknowledged} atendida${counts.acknowledged === 1 ? "" : "s"}`}
          onClear={() => {
            setQuery("");
            setType("");
            setSeverity("");
            setDates({ from: "", to: "" });
          }}
          dateRange={{ value: dates, onChange: setDates, label: "Fecha de alerta" }}
          selects={[
            {
              key: "severity",
              placeholder: "Severidad",
              value: severity,
              onChange: setSeverity,
              options: [
                { value: "critical", label: "Alta" },
                { value: "warning", label: "Media" },
                { value: "info", label: "Baja" },
              ],
            },
            {
              key: "type",
              placeholder: "Tipo de alerta",
              value: type,
              onChange: setType,
              options: typeOptions,
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Alertas abiertas"
          value={formatNumber(counts.live)}
          tone="warn"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Ver abiertas"
          active={tab === "live"}
          onClick={() => setTab("live")}
        />
        <KpiCard
          title="Severidad alta"
          value={formatNumber(criticalCount)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Filtrar alta"
          active={severity === "critical"}
          onClick={() => {
            setSeverity("critical");
            setTab("live");
          }}
        />
        <KpiCard
          title="Atendidas"
          value={formatNumber(counts.acknowledged)}
          tone="info"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Ver atendidas"
          active={tab === "acknowledged"}
          onClick={() => setTab("acknowledged")}
        />
        <KpiCard
          title="Resueltas"
          value={formatNumber(counts.resolved)}
          tone="good"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Ver resueltas"
          active={tab === "resolved"}
          onClick={() => setTab("resolved")}
        />
      </div>

      <div className="mb-4">
        <Tabs
          tabs={TABS.map((t) => ({ ...t, count: counts[t.value as keyof typeof counts] }))}
          value={tab}
          onChange={setTab}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<IconCheck className="w-6 h-6" />}
              title={tab === "live" ? "No hay alertas abiertas" : "Sin alertas en esta vista"}
              description={
                tab === "live"
                  ? "Todo está en orden por ahora. Revisa otra pestaña o continúa con la reposición."
                  : "No hay alertas que coincidan con los filtros seleccionados."
              }
              action={
                tab === "live" ? (
                  <Button variant="secondary" onClick={() => navigate("/comprar/decisiones")}>
                    Ir a reposición
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[minmax(320px,380px)_1fr] gap-4">
          {/* Lista (inbox) agrupada por tiempo */}
          <div className="space-y-3 lg:max-h-[72vh] lg:overflow-y-auto no-scrollbar lg:pr-1">
            {groupByTime(filtered).map((bucket) => (
              <div key={bucket.key}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                  {bucket.label}
                </p>
                <div className="space-y-1.5">
                  {bucket.items.map((a) => (
                    <AlertRow
                      key={a.id}
                      alert={a}
                      selected={selected?.id === a.id}
                      onClick={() => {
                        setSelectedId(a.id);
                        setMobileDetail(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Detalle (escritorio) */}
          <div className="hidden lg:block">
            {selected && (
              <AlertDetail
                alert={selected}
                busy={busyId === selected.id}
                onAcknowledge={() => void runAction(selected, "acknowledge")}
                onResolve={() => void runAction(selected, "resolve")}
                onDismiss={() => setDismissing(selected)}
              />
            )}
          </div>
        </div>
      )}

      {/* Detalle móvil en drawer */}
      <Drawer
        open={mobileDetail && !!selected}
        onClose={() => setMobileDetail(false)}
        title="Detalle de alerta"
      >
        {selected && (
          <AlertDetail
            alert={selected}
            busy={busyId === selected.id}
            onAcknowledge={() => void runAction(selected, "acknowledge")}
            onResolve={() => void runAction(selected, "resolve")}
            onDismiss={() => setDismissing(selected)}
          />
        )}
      </Drawer>

      {dismissing && (
        <DismissAlertModal
          alert={dismissing}
          busy={busyId === dismissing.id}
          onConfirm={(reason) => void runAction(dismissing, "dismiss", reason)}
          onClose={() => setDismissing(null)}
        />
      )}
    </div>
  );
}

/** Agrupa alertas por antigüedad (Hoy / Ayer / Esta semana / Anteriores). */
function groupByTime(items: AlertView[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const daysAgo = (iso: string) => {
    const created = new Date(`${iso.slice(0, 10)}T00:00:00`).getTime();
    if (!Number.isFinite(created)) return 0;
    return Math.round((today - created) / 86_400_000);
  };
  const buckets: { key: string; label: string; items: AlertView[] }[] = [
    { key: "hoy", label: "Hoy", items: [] },
    { key: "ayer", label: "Ayer", items: [] },
    { key: "semana", label: "Esta semana", items: [] },
    { key: "antes", label: "Anteriores", items: [] },
  ];
  for (const a of items) {
    const d = a.dateCreated ? daysAgo(a.dateCreated) : 0;
    if (d <= 0) buckets[0].items.push(a);
    else if (d === 1) buckets[1].items.push(a);
    else if (d <= 7) buckets[2].items.push(a);
    else buckets[3].items.push(a);
  }
  return buckets.filter((b) => b.items.length > 0);
}

const fmtDate = (iso: string | null) => (iso ? formatDate(iso.slice(0, 10)) : "—");

function AlertRow({
  alert,
  selected,
  onClick,
}: {
  alert: AlertView;
  selected: boolean;
  onClick: () => void;
}) {
  const unattended = alert.status === "active";
  const type = alertTypeUi(alert.type);
  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className={cn(
        "w-full cursor-pointer rounded-lg border px-3 py-2.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
        selected ? "border-brand-300 bg-brand-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <SeverityBadge severity={ALERT_SEVERITY_TO_UI[alert.severity]} />
        <Badge tone={type.tone}>{type.group}</Badge>
        {unattended && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" title="Sin atender" />}
        <div className="flex-1" />
        <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(alert.dateCreated)}</span>
      </div>
      <p
        className={cn(
          "text-sm truncate",
          unattended ? "font-semibold text-slate-900" : "font-medium text-slate-700"
        )}
      >
        {alert.title}
      </p>
      <p className="text-xs text-slate-500 truncate">
        {ALERT_REF_ENTITY_LABEL[alert.refEntity] ?? alert.refEntity} · {alert.refId}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        <Badge tone={ALERT_STATUS_UI[alert.status].tone} dot={false}>
          {ALERT_STATUS_UI[alert.status].label}
        </Badge>
      </div>
    </div>
  );
}

function AlertDetail({
  alert,
  busy,
  onAcknowledge,
  onResolve,
  onDismiss,
}: {
  alert: AlertView;
  busy: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
  onDismiss: () => void;
}) {
  const type = alertTypeUi(alert.type);
  const link = alertRefLink(alert.refEntity, alert.refId);
  const live = isLiveAlert(alert.status);
  return (
    <Card>
      <div className="p-4 lg:sticky lg:top-20">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <SeverityBadge severity={ALERT_SEVERITY_TO_UI[alert.severity]} />
          <span className="text-xs font-medium text-slate-500">{type.label}</span>
          <div className="flex-1" />
          <Badge tone={ALERT_STATUS_UI[alert.status].tone} dot={false}>
            {ALERT_STATUS_UI[alert.status].label}
          </Badge>
          <span className="text-xs text-slate-400">{fmtDate(alert.dateCreated)}</span>
        </div>

        <h3 className="text-lg font-semibold text-slate-900">{alert.title}</h3>
        <p className="text-sm text-slate-600 mt-1">
          {ALERT_REF_ENTITY_LABEL[alert.refEntity] ?? alert.refEntity} referida:{" "}
          <span className="font-mono text-slate-700">{alert.refId}</span>
        </p>

        {alert.status === "dismissed" && alert.dismissReason && (
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-500">Motivo del descarte</p>
            <p className="text-sm text-slate-700 mt-0.5">{alert.dismissReason}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-3">
          {link && (
            <Link to={link.to}>
              <Button size="sm">{link.label}</Button>
            </Link>
          )}
          {alert.status === "active" && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onAcknowledge}>
              {busy ? "Aplicando…" : "Atender"}
            </Button>
          )}
          {live && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onResolve}>
              {busy ? "Aplicando…" : "Resolver"}
            </Button>
          )}
          {live && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={onDismiss}>
              Descartar
            </Button>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
            Detalle
          </p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Comprador</span>
              <span className="text-slate-700">{alert.buyerId ?? "Toda la mesa"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Fecha</span>
              <span className="text-slate-700">{fmtDate(alert.dateCreated)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Regla</span>
              <span className="font-mono text-slate-700">{alert.ruleKey}</span>
            </div>
            {alert.acknowledgedBy && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Atendida por</span>
                <span className="text-slate-700">{alert.acknowledgedBy}</span>
              </div>
            )}
            {alert.resolvedAt && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Resuelta el</span>
                <span className="text-slate-700">{fmtDate(alert.resolvedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Descartar exige motivo (lo valida el dominio): modal mínimo, patrón F4/F5. */
function DismissAlertModal({
  alert,
  busy,
  onConfirm,
  onClose,
}: {
  alert: AlertView;
  busy: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Descartar alerta"
      description={alert.title}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy || !reason.trim()} onClick={() => onConfirm(reason.trim())}>
            {busy ? "Descartando…" : "Descartar alerta"}
          </Button>
        </>
      }
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Motivo del descarte (obligatorio)
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={1000}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
          placeholder="Ej: condición conocida, ya gestionada fuera del sistema…"
        />
      </div>
    </Modal>
  );
}
