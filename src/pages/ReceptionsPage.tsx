import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { FilterBar } from "../components/business/FilterBar";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Select";
import { DataTable, type Column } from "../components/ui/Table";
import { useUrlState } from "../utils/useUrlState";
import { useBuyer } from "../context/BuyerContext";
import { receptions, RECEPTION_STATUS } from "../data/mockReceptions";
import { uniqueValues } from "../utils/filters";
import { formatDate, formatNumber, formatPercent } from "../utils/formatters";
import { IconAlerts, IconCheck, IconClock } from "../components/ui/icons";
import type { Reception } from "../types/purchasing";

const ARRIVING: Reception["status"][] = ["in_transit", "scheduled"];

export function ReceptionsPage() {
  const navigate = useNavigate();
  const { buyer, buyers } = useBuyer();
  const [scope, setScope] = useUrlState("alcance", "mias");
  const [tab, setTab] = useUrlState("tab", "arriving");
  const [query, setQuery] = useUrlState("q");
  const [supplier, setSupplier] = useUrlState("prov");

  const scoped = useMemo(() => {
    if (scope === "todos") return receptions;
    const target = scope === "mias" ? buyer : scope;
    return receptions.filter((r) => r.buyer === target);
  }, [scope, buyer]);

  const byFilters = useMemo(
    () =>
      scoped.filter((r) => {
        if (query.trim() && !`${r.poNumber} ${r.supplierName}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (supplier && r.supplierName !== supplier) return false;
        return true;
      }),
    [scoped, query, supplier]
  );

  const counts = {
    arriving: byFilters.filter((r) => ARRIVING.includes(r.status)).length,
    received: byFilters.filter((r) => r.status === "received").length,
    issues: byFilters.filter((r) => r.status === "with_issues" || r.status === "partial").length,
    delayed: byFilters.filter((r) => r.status === "delayed").length,
    all: byFilters.length,
  };

  const filtered = useMemo(() => {
    let base = byFilters;
    if (tab === "arriving") base = base.filter((r) => ARRIVING.includes(r.status));
    else if (tab === "received") base = base.filter((r) => r.status === "received");
    else if (tab === "issues") base = base.filter((r) => r.status === "with_issues" || r.status === "partial");
    else if (tab === "delayed") base = base.filter((r) => r.status === "delayed");
    // por llegar primero por fecha esperada; resto por fecha reciente
    return [...base].sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1));
  }, [byFilters, tab]);

  const scopeLabel = scope === "todos" ? "Todos los compradores" : scope === "mias" ? `Mis recepciones (${buyer})` : `Comprador ${scope}`;

  const pct = (r: Reception) => (r.unitsExpected > 0 ? Math.round((r.unitsReceived / r.unitsExpected) * 100) : 0);

  const columns: Column<Reception>[] = [
    {
      key: "po",
      header: "Orden / Proveedor",
      render: (r) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-slate-800">{r.poNumber}</p>
          <p className="text-xs text-slate-500">{r.supplierName}</p>
          <p className="text-xs text-slate-400">{r.warehouse}</p>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Esperada / Recibida",
      hideOnMobile: true,
      render: (r) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatDate(r.expectedDate)}</p>
          <p className="text-xs text-slate-400">{r.receivedDate ? `recibida ${formatDate(r.receivedDate)}` : "pendiente"}</p>
        </div>
      ),
    },
    {
      key: "recepcion",
      header: "Recepción",
      align: "right",
      render: (r) => {
        const p = pct(r);
        return (
          <div className="text-sm min-w-[90px]">
            <p className="font-medium text-slate-800">{formatNumber(r.unitsReceived)}/{formatNumber(r.unitsExpected)} u.</p>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-1">
              <div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : p > 0 ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${Math.max(3, p)}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "quality",
      header: "Calidad",
      render: (r) =>
        r.qualityOk ? (
          <Badge tone="green" dot>Conforme</Badge>
        ) : (
          <Badge tone="red" dot>Con observación</Badge>
        ),
    },
    {
      key: "note",
      header: "Detalle",
      hideOnMobile: true,
      render: (r) => <p className="text-xs text-slate-600 max-w-xs leading-snug">{r.qualityNote}</p>,
    },
    { key: "status", header: "Estado", render: (r) => <Badge tone={RECEPTION_STATUS[r.status].tone} dot>{RECEPTION_STATUS[r.status].label}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Recepciones"
        description="Qué viene en camino, qué llegó y cómo llegó."
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="sm:w-72">
          <Select
            label="Viendo"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            options={[
              { value: "mias", label: `Mis recepciones (${buyer})` },
              { value: "todos", label: "Todas" },
              ...buyers.filter((b) => b !== buyer).map((b) => ({ value: b, label: `Comprador: ${b}` })),
            ]}
          />
        </div>
        <span className="text-xs text-slate-500 sm:self-end sm:pb-2">Alcance: <b className="text-slate-700">{scopeLabel}</b></span>
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar OC o proveedor"
          resultCount={filtered.length}
          summary={`${counts.arriving} por llegar · ${counts.delayed} atrasadas · ${counts.issues} con problemas`}
          onClear={() => { setQuery(""); setSupplier(""); }}
          selects={[
            { key: "prov", placeholder: "Proveedor", value: supplier, onChange: setSupplier, options: uniqueValues(receptions, (r) => r.supplierName).map((s) => ({ value: s, label: s })) },
          ]}
        />
      </div>

      <div className="hidden md:grid md:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Por llegar" value={formatNumber(counts.arriving)} tone="info" icon={<IconClock className="w-4 h-4" />} description="En tránsito o programadas" active={tab === "arriving"} onClick={() => setTab("arriving")} />
        <KpiCard title="Atrasadas" value={formatNumber(counts.delayed)} tone="bad" icon={<IconAlerts className="w-4 h-4" />} description="Debieron llegar" active={tab === "delayed"} onClick={() => setTab("delayed")} />
        <KpiCard title="Con problemas" value={formatNumber(counts.issues)} tone="warn" icon={<IconAlerts className="w-4 h-4" />} description="Parcial o con calidad" active={tab === "issues"} onClick={() => setTab("issues")} />
        <KpiCard title="Recibidas" value={formatNumber(counts.received)} tone="good" icon={<IconCheck className="w-4 h-4" />} description="Conformes" active={tab === "received"} onClick={() => setTab("received")} />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "arriving", label: "Por llegar", count: counts.arriving },
          { value: "delayed", label: "Atrasadas", count: counts.delayed },
          { value: "issues", label: "Con problemas", count: counts.issues },
          { value: "received", label: "Recibidas", count: counts.received },
          { value: "all", label: "Todas", count: counts.all },
        ]}
      />

      <HelpNote className="mb-4">
        La barra de <b>recepción</b> muestra cuánto llegó vs lo pedido. <b>Calidad</b> marca si hubo
        observaciones (daño, faltante, humedad). Toca una recepción para ver su orden de compra.
      </HelpNote>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          onRowClick={() => navigate("/ordenes-compra")}
          rowClassName={(r) => (r.status === "delayed" || r.status === "with_issues" ? "bg-rose-50/40" : undefined)}
          emptyMessage="No hay recepciones en esta vista."
          mobileCard={(r) => {
            const p = pct(r);
            return (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{r.poNumber}</p>
                    <p className="text-xs text-slate-500">{r.supplierName} · {r.warehouse}</p>
                  </div>
                  <Badge tone={RECEPTION_STATUS[r.status].tone} dot>{RECEPTION_STATUS[r.status].label}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                  <div><p className="text-xs text-slate-400">Esperada</p><p className="text-slate-700">{formatDate(r.expectedDate)}</p></div>
                  <div><p className="text-xs text-slate-400">Recepción</p><p className="text-slate-700">{formatPercent(p, 0)}</p></div>
                  <div><p className="text-xs text-slate-400">Calidad</p><p className={r.qualityOk ? "text-emerald-600" : "text-rose-600"}>{r.qualityOk ? "Conforme" : "Observada"}</p></div>
                </div>
                <p className="text-xs text-slate-500 mt-1.5 leading-snug">{r.qualityNote}</p>
              </div>
            );
          }}
        />
      </Card>
    </div>
  );
}
