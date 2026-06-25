import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Link, useNavigate } from "react-router-dom";
import { FilterBar } from "../components/business/FilterBar";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Card, CardBody } from "../components/ui/Card";
import { Drawer } from "../components/ui/Drawer";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { SeverityBadge } from "../components/business/PriorityBadge";
import { StatusBadge } from "../components/business/StatusBadge";
import { alerts as seedAlerts } from "../data/mockAlerts";
import { recommendations } from "../data/mockRecommendations";
import { ALERT_TYPE_LABELS } from "../components/business/alertLabels";
import { filterAlerts } from "../utils/filters";
import { formatNumber, formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";
import { TODAY_ISO } from "../utils/constants";
import type { AlertType } from "../types/purchasing";
import { Badge, type BadgeTone } from "../components/ui/Badge";
import { useLocalStorage } from "../utils/useLocalStorage";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { IconAlerts, IconCheck } from "../components/ui/icons";
import type { AlertStatus } from "../types/purchasing";

const TABS = [
  { value: "active", label: "Activas" },
  { value: "new", label: "Nuevas" },
  { value: "in_review", label: "En revisión" },
  { value: "resolved", label: "Resueltas" },
  { value: "ignored", label: "Ignoradas" },
];

export function AlertsPage() {
  const navigate = useNavigate();
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();
  const [statusOverrides, setStatusOverrides] = useLocalStorage<Record<string, AlertStatus>>(
    "compras:alert-status",
    {}
  );
  const [tab, setTab] = useState("active");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [responsible, setResponsible] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);

  const alerts = useMemo(
    () =>
      seedAlerts.map((a) =>
        statusOverrides[a.id] ? { ...a, status: statusOverrides[a.id] } : a
      ),
    [statusOverrides]
  );

  const setStatus = (id: string, status: AlertStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
    toast.success(status === "resolved" ? "Alerta marcada como resuelta" : "Alerta marcada en revisión");
  };

  // Filtrado por la barra de filtros (sin la pestaña): controla KPIs y conteos
  const byFilters = useMemo(
    () => filterAlerts(alerts, { query, type, severity }).filter((a) => !responsible || a.responsible === responsible),
    [alerts, query, type, severity, responsible]
  );

  const responsibles = useMemo(
    () => Array.from(new Set(seedAlerts.map((a) => a.responsible))).sort((x, y) => x.localeCompare(y, "es")),
    []
  );

  const counts = useMemo(
    () => ({
      active: byFilters.filter((a) => a.status === "new" || a.status === "in_review").length,
      new: byFilters.filter((a) => a.status === "new").length,
      in_review: byFilters.filter((a) => a.status === "in_review").length,
      resolved: byFilters.filter((a) => a.status === "resolved").length,
      ignored: byFilters.filter((a) => a.status === "ignored").length,
    }),
    [byFilters]
  );

  const filtered = useMemo(() => {
    let base = byFilters;
    if (tab === "active") base = base.filter((a) => a.status === "new" || a.status === "in_review");
    else base = base.filter((a) => a.status === tab);
    const order = { high: 0, medium: 1, low: 2 };
    return [...base].sort((a, b) => order[a.severity] - order[b.severity]);
  }, [byFilters, tab]);

  const highCount = byFilters.filter((a) => a.severity === "high" && (a.status === "new" || a.status === "in_review")).length;

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0];

  // Acción sugerida concreta según el tipo de alerta
  const actionForAlert = (a: (typeof filtered)[number]) => {
    const rec = a.relatedSku
      ? recommendations.find((r) => r.sku === a.relatedSku && r.suggestedQuantity > 0)
      : undefined;
    if (rec) {
      const added = hasItem(rec.sku);
      return {
        label: added ? "Agregado a OC" : "Agregar a OC",
        disabled: added,
        onClick: () => {
          addItem({
            sku: rec.sku,
            productName: rec.productName,
            supplierName: rec.supplierName,
            quantity: rec.suggestedQuantity,
            unitCost: rec.unitCost,
          });
          toast.success(`${rec.productName} agregado al borrador de OC`, { label: "Ver borrador OC", onClick: () => navigate("/ordenes-compra") });
        },
      };
    }
    if (a.type === "po_delayed")
      return { label: "Ver órdenes de compra", onClick: () => navigate("/ordenes-compra") };
    if (a.type === "supplier_delay")
      return { label: "Revisar proveedor", onClick: () => navigate("/proveedores") };
    if (a.relatedSku)
      return { label: "Ver producto", onClick: () => navigate(`/productos/${a.relatedSku}`) };
    return undefined;
  };

  return (
    <div>
      <PageHeader
        title="Alertas comerciales"
        description="Problemas que requieren tu atención, con acción sugerida."
      />

      {/* Filtros arriba: controlan KPIs, conteos y listado */}
      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por producto, proveedor o SKU"
          resultCount={byFilters.length}
          summary={`${byFilters.length} alerta${byFilters.length === 1 ? "" : "s"} · ${highCount} alta severidad · ${counts.in_review} en revisión`}
          onClear={() => { setQuery(""); setType(""); setSeverity(""); setResponsible(""); }}
          selects={[
            {
              key: "severity",
              placeholder: "Severidad",
              value: severity,
              onChange: setSeverity,
              options: [
                { value: "high", label: "Alta" },
                { value: "medium", label: "Media" },
                { value: "low", label: "Baja" },
              ],
            },
            {
              key: "type",
              placeholder: "Tipo de alerta",
              value: type,
              onChange: setType,
              options: Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            },
            {
              key: "responsible",
              placeholder: "Responsable",
              value: responsible,
              onChange: setResponsible,
              options: responsibles.map((r) => ({ value: r, label: r })),
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Alertas activas" value={formatNumber(counts.active)} tone="warn" icon={<IconAlerts className="w-4 h-4" />} description="Ver activas" active={tab === "active"} onClick={() => setTab("active")} />
        <KpiCard title="Severidad alta" value={formatNumber(highCount)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Filtrar alta" active={severity === "high"} onClick={() => { setSeverity("high"); setTab("active"); }} />
        <KpiCard title="En revisión" value={formatNumber(counts.in_review)} tone="info" icon={<IconAlerts className="w-4 h-4" />} description="Ver en revisión" active={tab === "in_review"} onClick={() => setTab("in_review")} />
        <KpiCard title="Resueltas" value={formatNumber(counts.resolved)} tone="good" icon={<IconAlerts className="w-4 h-4" />} description="Ver resueltas" active={tab === "resolved"} onClick={() => setTab("resolved")} />
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
              title={tab === "active" ? "No hay alertas activas" : "Sin alertas en esta vista"}
              description={
                tab === "active"
                  ? "Todo está en orden por ahora. Revisa otra pestaña o continúa con la reposición."
                  : "No hay alertas que coincidan con los filtros seleccionados."
              }
              action={tab === "active" ? <Button variant="secondary" onClick={() => navigate("/reposicion")}>Ir a reposición</Button> : undefined}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[minmax(320px,380px)_1fr] gap-4">
          {/* Lista (inbox) agrupada por tiempo */}
          <div className="space-y-3 lg:max-h-[72vh] lg:overflow-y-auto no-scrollbar lg:pr-1">
            {groupByTime(filtered).map((bucket) => (
              <div key={bucket.key}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">{bucket.label}</p>
                <div className="space-y-1.5">
                  {bucket.items.map((a) => (
                    <AlertRow
                      key={a.id}
                      alert={a}
                      selected={selected?.id === a.id}
                      action={actionForAlert(a)}
                      onClick={() => { setSelectedId(a.id); setMobileDetail(true); }}
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
                primaryAction={actionForAlert(selected)}
                onReview={() => setStatus(selected.id, "in_review")}
                onResolve={() => setStatus(selected.id, "resolved")}
              />
            )}
          </div>
        </div>
      )}

      {/* Detalle móvil en drawer */}
      <Drawer open={mobileDetail && !!selected} onClose={() => setMobileDetail(false)} title="Detalle de alerta">
        {selected && (
          <AlertDetail
            alert={selected}
            primaryAction={actionForAlert(selected)}
            onReview={() => setStatus(selected.id, "in_review")}
            onResolve={() => setStatus(selected.id, "resolved")}
          />
        )}
      </Drawer>
    </div>
  );
}

const TYPE_GROUP: Record<AlertType, { label: string; tone: BadgeTone }> = {
  stockout: { label: "Stock", tone: "red" },
  stockout_risk: { label: "Stock", tone: "amber" },
  overstock: { label: "Stock", tone: "violet" },
  dead_stock: { label: "Stock", tone: "violet" },
  no_sales: { label: "Stock", tone: "neutral" },
  po_delayed: { label: "OC", tone: "red" },
  supplier_delay: { label: "Proveedor", tone: "amber" },
  no_supplier: { label: "Proveedor", tone: "red" },
  unexpected_demand: { label: "Demanda", tone: "blue" },
  high_suggested_purchase: { label: "Demanda", tone: "blue" },
  low_margin: { label: "Margen", tone: "amber" },
  cost_increase: { label: "Margen", tone: "amber" },
  outdated_cost: { label: "Margen", tone: "neutral" },
};

/** Agrupa alertas por antigüedad (Hoy / Ayer / Esta semana / Anteriores). */
function groupByTime(items: (typeof seedAlerts)[number][]) {
  const today = new Date(`${TODAY_ISO}T00:00:00`).getTime();
  const daysAgo = (iso: string) => Math.round((today - new Date(`${iso}T00:00:00`).getTime()) / 86400000);
  const buckets: { key: string; label: string; items: (typeof seedAlerts)[number][] }[] = [
    { key: "hoy", label: "Hoy", items: [] },
    { key: "ayer", label: "Ayer", items: [] },
    { key: "semana", label: "Esta semana", items: [] },
    { key: "antes", label: "Anteriores", items: [] },
  ];
  for (const a of items) {
    const d = daysAgo(a.date);
    if (d <= 0) buckets[0].items.push(a);
    else if (d === 1) buckets[1].items.push(a);
    else if (d <= 7) buckets[2].items.push(a);
    else buckets[3].items.push(a);
  }
  return buckets.filter((b) => b.items.length > 0);
}

function AlertRow({
  alert,
  selected,
  onClick,
  action,
}: {
  alert: (typeof seedAlerts)[number];
  selected: boolean;
  onClick: () => void;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  const unread = alert.status === "new";
  const type = TYPE_GROUP[alert.type];
  return (
    <div
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer rounded-lg border px-3 py-2.5 transition-colors",
        selected ? "border-brand-300 bg-brand-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <SeverityBadge severity={alert.severity} />
        <Badge tone={type.tone}>{type.label}</Badge>
        {unread && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" title="No leída" />}
        <div className="flex-1" />
        <span className="text-xs text-slate-400 flex-shrink-0">{formatDate(alert.date)}</span>
      </div>
      <p className={cn("text-sm truncate", unread ? "font-semibold text-slate-900" : "font-medium text-slate-700")}>{alert.relatedEntity}</p>
      <p className="text-xs text-slate-500 line-clamp-2">{alert.description}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <StatusBadge kind="alert" value={alert.status} dot={false} />
        {action && (
          <button
            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
            disabled={action.disabled}
            className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:text-slate-400"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}

function AlertDetail({
  alert,
  primaryAction,
  onReview,
  onResolve,
}: {
  alert: (typeof seedAlerts)[number];
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  onReview: () => void;
  onResolve: () => void;
}) {
  return (
    <Card>
      <div className="p-4 lg:sticky lg:top-20">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <SeverityBadge severity={alert.severity} />
          <span className="text-xs font-medium text-slate-500">{ALERT_TYPE_LABELS[alert.type]}</span>
          <div className="flex-1" />
          <StatusBadge kind="alert" value={alert.status} dot={false} />
          <span className="text-xs text-slate-400">{formatDate(alert.date)}</span>
        </div>

        {alert.relatedSku ? (
          <Link to={`/productos/${alert.relatedSku}`} className="text-lg font-semibold text-brand-700 hover:underline">{alert.relatedEntity}</Link>
        ) : (
          <h3 className="text-lg font-semibold text-slate-900">{alert.relatedEntity}</h3>
        )}
        <p className="text-sm text-slate-600 mt-1">{alert.description}</p>

        <div className="mt-3 rounded-lg bg-brand-50/60 border border-brand-100 px-3 py-2.5">
          <p className="text-xs font-medium text-brand-700">Recomendación</p>
          <p className="text-sm text-slate-700 mt-0.5">{alert.recommendation}</p>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {primaryAction && (
            <Button size="sm" disabled={primaryAction.disabled} onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          )}
          {alert.status === "new" && <Button size="sm" variant="secondary" onClick={onReview}>Marcar en revisión</Button>}
          {alert.status !== "resolved" && alert.status !== "ignored" && <Button size="sm" variant="secondary" onClick={onResolve}>Marcar resuelta</Button>}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Detalle</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-2"><span className="text-slate-500">Responsable</span><span className="text-slate-700">{alert.responsible}</span></div>
            <div className="flex justify-between gap-2"><span className="text-slate-500">Fecha</span><span className="text-slate-700">{formatDate(alert.date)}</span></div>
            {alert.relatedSku && <div className="flex justify-between gap-2"><span className="text-slate-500">SKU</span><span className="font-mono text-slate-700">{alert.relatedSku}</span></div>}
          </div>
        </div>
      </div>
    </Card>
  );
}
