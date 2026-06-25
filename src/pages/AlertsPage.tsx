import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { useNavigate } from "react-router-dom";
import { AlertCard } from "../components/business/AlertCard";
import { FilterBar } from "../components/business/FilterBar";
import { KpiCard } from "../components/business/KpiCard";
import { Tabs } from "../components/ui/Tabs";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { alerts as seedAlerts } from "../data/mockAlerts";
import { recommendations } from "../data/mockRecommendations";
import { ALERT_TYPE_LABELS } from "../components/business/alertLabels";
import { filterAlerts } from "../utils/filters";
import { formatNumber } from "../utils/formatters";
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
    () => filterAlerts(alerts, { query, type, severity }),
    [alerts, query, type, severity]
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
        description="Problemas que requieren atención del comprador: quiebres, sobrestock, proveedores atrasados, margen bajo y órdenes vencidas. Cada alerta explica el problema y propone una acción."
      />

      {/* Filtros arriba: controlan KPIs, conteos y listado */}
      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por producto, proveedor o SKU"
          resultCount={byFilters.length}
          summary={`${byFilters.length} alerta${byFilters.length === 1 ? "" : "s"} · ${highCount} alta severidad · ${counts.in_review} en revisión`}
          onClear={() => { setQuery(""); setType(""); setSeverity(""); }}
          selects={[
            {
              key: "type",
              placeholder: "Tipo de alerta",
              value: type,
              onChange: setType,
              options: Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
            },
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

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onReview={(id) => setStatus(id, "in_review")}
              onResolve={(id) => setStatus(id, "resolved")}
              primaryAction={actionForAlert(a)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardBody>
            <EmptyState
              icon={<IconCheck className="w-6 h-6" />}
              title={tab === "active" ? "No hay alertas activas" : "Sin alertas en esta vista"}
              description={
                tab === "active"
                  ? "Todo está en orden por ahora. Revisa las alertas de prioridad media o continúa con la reposición sugerida."
                  : "No hay alertas que coincidan con los filtros seleccionados."
              }
              action={
                tab === "active" ? (
                  <Button variant="secondary" onClick={() => navigate("/reposicion")}>
                    Ir a reposición sugerida
                  </Button>
                ) : undefined
              }
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
