import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { FilterBar } from "../components/business/FilterBar";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Drawer } from "../components/ui/Drawer";
import { DataTable, type Column } from "../components/ui/Table";
import { useUrlState } from "../utils/useUrlState";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import { useOcDraft } from "../context/OcDraftContext";
import { useToast } from "../context/ToastContext";
import { receptions, RECEPTION_STATUS } from "../data/mockReceptions";
import { getProductBySku } from "../data/mockProducts";
import { supplierFulfillment } from "../utils/supplierPerf";
import { uniqueValues } from "../utils/filters";
import { formatDate, formatNumber, formatPercent } from "../utils/formatters";
import { IconAlerts, IconCheck, IconClock, IconPlus, IconBox } from "../components/ui/icons";
import type { Reception, ReceptionItem } from "../types/purchasing";

const ARRIVING: Reception["status"][] = ["in_transit", "scheduled"];
const ARRIVED: Reception["status"][] = ["received", "partial", "with_issues"];

function lineStatus(it: ReceptionItem): { label: string; tone: "green" | "amber" | "red" } {
  if (it.received >= it.expected) return { label: "Completo", tone: "green" };
  if (it.received === 0) return { label: "No despachado", tone: "red" };
  return { label: "Parcial", tone: "amber" };
}

interface MissingLine {
  r: Reception;
  it: ReceptionItem;
  missing: number;
}

export function ReceptionsPage() {
  const navigate = useNavigate();
  const { buyer, buyers } = useBuyer();
  const { role } = useRole();
  const isLeader = role === "lider";
  const { addItem, hasItem } = useOcDraft();
  const toast = useToast();
  const [scope, setScope] = useUrlState("alcance", isLeader ? "todos" : "mias");
  const [tab, setTab] = useUrlState("tab", "arriving");
  const [query, setQuery] = useUrlState("q");
  const [supplier, setSupplier] = useUrlState("prov");
  const [detail, setDetail] = useState<Reception | null>(null);

  const scoped = useMemo(() => {
    if (scope === "todos") return receptions;
    const target = scope === "mias" ? buyer : scope;
    return receptions.filter((r) => r.buyer === target);
  }, [scope, buyer]);

  const byFilters = useMemo(
    () =>
      scoped.filter((r) => {
        if (query.trim() && !`${r.poNumber} ${r.supplierName} ${r.buyer}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (supplier && r.supplierName !== supplier) return false;
        return true;
      }),
    [scoped, query, supplier]
  );

  const undeliveredLines = useMemo<MissingLine[]>(
    () =>
      byFilters
        .filter((r) => ARRIVED.includes(r.status))
        .flatMap((r) => (r.items ?? []).filter((it) => it.received < it.expected).map((it) => ({ r, it, missing: it.expected - it.received })))
        .sort((a, b) => b.missing - a.missing),
    [byFilters]
  );

  // Agrupado por proveedor (quién no cumple)
  const bySupplier = useMemo(() => {
    const m = new Map<string, MissingLine[]>();
    undeliveredLines.forEach((l) => {
      const arr = m.get(l.r.supplierName) ?? [];
      arr.push(l);
      m.set(l.r.supplierName, arr);
    });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [undeliveredLines]);

  // Responsables de reordenar (quién, para el líder)
  const byBuyer = useMemo(() => {
    const m = new Map<string, { count: number; suppliers: Set<string> }>();
    undeliveredLines.forEach((l) => {
      const e = m.get(l.r.buyer) ?? { count: 0, suppliers: new Set<string>() };
      e.count += 1;
      e.suppliers.add(l.r.supplierName);
      m.set(l.r.buyer, e);
    });
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [undeliveredLines]);

  const counts = {
    arriving: byFilters.filter((r) => ARRIVING.includes(r.status)).length,
    received: byFilters.filter((r) => r.status === "received").length,
    issues: byFilters.filter((r) => r.status === "with_issues" || r.status === "partial").length,
    delayed: byFilters.filter((r) => r.status === "delayed").length,
    undelivered: undeliveredLines.length,
    all: byFilters.length,
  };

  const filtered = useMemo(() => {
    let base = byFilters;
    if (tab === "arriving") base = base.filter((r) => ARRIVING.includes(r.status));
    else if (tab === "received") base = base.filter((r) => r.status === "received");
    else if (tab === "issues") base = base.filter((r) => r.status === "with_issues" || r.status === "partial");
    else if (tab === "delayed") base = base.filter((r) => r.status === "delayed");
    return [...base].sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1));
  }, [byFilters, tab]);

  const scopeLabel = scope === "todos" ? "Todos los compradores" : scope === "mias" ? `Mis recepciones (${buyer})` : `Comprador ${scope}`;
  const pct = (r: Reception) => (r.unitsExpected > 0 ? Math.round((r.unitsReceived / r.unitsExpected) * 100) : 0);
  const missingOf = (r: Reception) => (r.items ?? []).filter((it) => it.received < it.expected);

  const reorder = (sku: string, name: string, supplierName: string, missing: number) => {
    if (hasItem(sku)) {
      toast.info(`${name} ya está en el borrador de OC`);
      return;
    }
    const p = getProductBySku(sku);
    addItem({ sku, productName: name, supplierName, quantity: missing, unitCost: p?.cost ?? 0 });
    toast.success(`${name}: ${formatNumber(missing)} u. agregadas al borrador de OC`, {
      label: "Ver borrador OC",
      onClick: () => navigate("/ordenes-compra"),
    });
  };

  const columns: Column<Reception>[] = [
    {
      key: "po",
      header: "Orden / Proveedor",
      render: (r) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-slate-800">{r.poNumber}</p>
          <p className="text-xs text-slate-500">{r.supplierName}</p>
          <p className="text-xs text-slate-400">{scope === "todos" ? r.buyer : r.warehouse}</p>
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
        const miss = missingOf(r);
        return (
          <div className="text-sm min-w-[110px]">
            <p className="font-medium text-slate-800">{formatNumber(r.unitsReceived)}/{formatNumber(r.unitsExpected)} u.</p>
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-1">
              <div className={`h-full rounded-full ${p >= 100 ? "bg-emerald-500" : p > 0 ? "bg-amber-500" : "bg-slate-300"}`} style={{ width: `${Math.max(3, p)}%` }} />
            </div>
            {miss.length > 0 && ARRIVED.includes(r.status) && (
              <p className="text-[11px] text-rose-600 mt-1">{miss.length} SKU{miss.length === 1 ? "" : "s"} sin despachar</p>
            )}
          </div>
        );
      },
    },
    {
      key: "quality",
      header: "Calidad",
      render: (r) => (r.qualityOk ? <Badge tone="green" dot>Conforme</Badge> : <Badge tone="red" dot>Con observación</Badge>),
    },
    { key: "status", header: "Estado", render: (r) => <Badge tone={RECEPTION_STATUS[r.status].tone} dot>{RECEPTION_STATUS[r.status].label}</Badge> },
    { key: "action", header: "", render: () => <span className="text-xs font-medium text-brand-600">Ver detalle →</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Recepciones"
        description={isLeader
          ? "Qué llegó, qué SKUs no despachó cada proveedor y qué encargado de compra debe reordenarlos. Visión global del equipo."
          : "Qué viene en camino, qué llegó y qué SKUs el proveedor no despachó para que no se queden sin reponer."}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="sm:w-72">
          <Select
            label="Viendo"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            options={[
              { value: "todos", label: "Todo el equipo" },
              { value: "mias", label: `Mis recepciones (${buyer})` },
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
          searchPlaceholder="Buscar OC, proveedor o comprador"
          resultCount={tab === "undelivered" ? undeliveredLines.length : filtered.length}
          summary={`${counts.undelivered} SKUs sin despachar · ${counts.arriving} por llegar · ${counts.delayed} atrasadas`}
          onClear={() => { setQuery(""); setSupplier(""); }}
          selects={[
            { key: "prov", placeholder: "Proveedor", value: supplier, onChange: setSupplier, options: uniqueValues(receptions, (r) => r.supplierName).map((s) => ({ value: s, label: s })) },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiCard title="No despachado" value={formatNumber(counts.undelivered)} tone="bad" icon={<IconBox className="w-4 h-4" />} description="SKUs que el proveedor no envió" active={tab === "undelivered"} onClick={() => setTab("undelivered")} />
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
          { value: "undelivered", label: "No despachado", count: counts.undelivered },
          { value: "arriving", label: "Por llegar", count: counts.arriving },
          { value: "delayed", label: "Atrasadas", count: counts.delayed },
          { value: "issues", label: "Con problemas", count: counts.issues },
          { value: "received", label: "Recibidas", count: counts.received },
          { value: "all", label: "Todas", count: counts.all },
        ]}
      />

      {tab === "undelivered" ? (
        <>
          <HelpNote className="mb-4">
            Lo que <b>pediste pero el proveedor no despachó</b>. Reordénalo aquí para que no quede como "ya comprado" y termine en quiebre.
            {isLeader && " Abajo ves qué encargado de compra es responsable de reponer cada caso."}
          </HelpNote>

          {undeliveredLines.length === 0 ? (
            <Card><div className="p-8 text-center text-sm text-slate-500">Sin SKUs pendientes por despachar. 🎉</div></Card>
          ) : (
            <>
              {/* Responsables de reordenar (vista global / líder) */}
              {byBuyer.length > 1 && (
                <Card className="mb-4">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">Responsables de reordenar</p>
                    <p className="text-xs text-slate-400">Encargados de compra con SKUs sin reponer por incumplimiento del proveedor.</p>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {byBuyer.map(([bName, info]) => (
                      <button key={bName} onClick={() => setScope(bName === buyer ? "mias" : bName)} className="flex items-center gap-3 w-full text-left px-4 py-2.5 hover:bg-slate-50">
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-slate-800">{bName}</span>
                          <span className="block text-xs text-slate-400 truncate">Proveedores: {[...info.suppliers].join(", ")}</span>
                        </span>
                        <Badge tone="red">{info.count} SKU{info.count === 1 ? "" : "s"} por reordenar</Badge>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Agrupado por proveedor que no cumplió */}
              <div className="space-y-4">
                {bySupplier.map(([sup, lines]) => {
                  const perf = supplierFulfillment(sup);
                  return (
                    <Card key={sup}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-800">{sup}</p>
                        <Badge tone={perf.tone}>{perf.ratingLabel}</Badge>
                        <span className="text-xs text-slate-500">Despacho <b className="text-slate-700">{perf.fillRate}%</b></span>
                        {perf.compliance !== null && <span className="text-xs text-slate-500">A tiempo <b className="text-slate-700">{perf.compliance}%</b></span>}
                        <span className="flex-1" />
                        <span className="text-xs font-semibold text-rose-600">{lines.length} SKU{lines.length === 1 ? "" : "s"} sin despachar</span>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {lines.map(({ r, it, missing }) => {
                          const st = lineStatus(it);
                          return (
                            <div key={`${r.id}-${it.sku}`} className="flex items-center gap-3 px-4 py-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-mono text-slate-400">{it.sku}</span>
                                  <Badge tone={st.tone}>{st.label}</Badge>
                                  {scope === "todos" && <span className="text-[11px] text-slate-500">resp. <b className="text-slate-700">{r.buyer}</b></span>}
                                </div>
                                <p className="text-sm font-medium text-slate-800 truncate">{it.productName}</p>
                                <p className="text-xs text-slate-500">{r.poNumber}</p>
                              </div>
                              <div className="text-right text-sm flex-shrink-0">
                                <p className="text-slate-700">{formatNumber(it.received)}/{formatNumber(it.expected)} u.</p>
                                <p className="text-xs font-semibold text-rose-600">faltan {formatNumber(missing)}</p>
                              </div>
                              <Button size="sm" variant={hasItem(it.sku) ? "secondary" : "primary"} disabled={hasItem(it.sku)} icon={<IconPlus className="w-3.5 h-3.5" />} onClick={() => reorder(it.sku, it.productName, r.supplierName, missing)}>
                                {hasItem(it.sku) ? "En OC" : "Reordenar"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <HelpNote className="mb-4">
            La barra de <b>recepción</b> muestra cuánto llegó vs lo pedido. Toca una recepción para ver el <b>detalle por producto</b>, el rendimiento del proveedor y reordenar lo no despachado.
          </HelpNote>
          <Card>
            <DataTable
              columns={columns}
              data={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => setDetail(r)}
              rowClassName={(r) => (r.status === "delayed" || r.status === "with_issues" || r.status === "partial" ? "bg-rose-50/40" : undefined)}
              emptyMessage="No hay recepciones en esta vista."
              mobileCard={(r) => {
                const p = pct(r);
                const miss = missingOf(r);
                return (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800">{r.poNumber}</p>
                        <p className="text-xs text-slate-500">{r.supplierName} · {scope === "todos" ? r.buyer : r.warehouse}</p>
                      </div>
                      <Badge tone={RECEPTION_STATUS[r.status].tone} dot>{RECEPTION_STATUS[r.status].label}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                      <div><p className="text-xs text-slate-400">Esperada</p><p className="text-slate-700">{formatDate(r.expectedDate)}</p></div>
                      <div><p className="text-xs text-slate-400">Recepción</p><p className="text-slate-700">{formatPercent(p, 0)}</p></div>
                      <div><p className="text-xs text-slate-400">Calidad</p><p className={r.qualityOk ? "text-emerald-600" : "text-rose-600"}>{r.qualityOk ? "Conforme" : "Observada"}</p></div>
                    </div>
                    {miss.length > 0 && ARRIVED.includes(r.status) && (
                      <p className="text-xs text-rose-600 mt-1.5 font-medium">{miss.length} SKU{miss.length === 1 ? "" : "s"} sin despachar · toca para ver</p>
                    )}
                  </div>
                );
              }}
            />
          </Card>
        </>
      )}

      {/* Detalle de recepción */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? detail.poNumber : ""}
        description={detail ? `${detail.supplierName} · resp. ${detail.buyer}` : ""}
        footer={
          detail && missingOf(detail).length > 0 ? (
            <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => { missingOf(detail).forEach((it) => reorder(it.sku, it.productName, detail.supplierName, it.expected - it.received)); setDetail(null); }}>
              Reordenar todo lo no despachado
            </Button>
          ) : undefined
        }
      >
        {detail && <ReceptionDetail detail={detail} reorder={reorder} hasItem={hasItem} />}
      </Drawer>
    </div>
  );
}

function ReceptionDetail({
  detail,
  reorder,
  hasItem,
}: {
  detail: Reception;
  reorder: (sku: string, name: string, supplierName: string, missing: number) => void;
  hasItem: (sku: string) => boolean;
}) {
  const perf = supplierFulfillment(detail.supplierName);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div><p className="text-xs text-slate-400">Esperada</p><p className="text-sm font-medium text-slate-800">{formatDate(detail.expectedDate)}</p></div>
        <div><p className="text-xs text-slate-400">Recibida</p><p className="text-sm font-medium text-slate-800">{detail.receivedDate ? formatDate(detail.receivedDate) : "Pendiente"}</p></div>
        <div><p className="text-xs text-slate-400">Estado</p><Badge tone={RECEPTION_STATUS[detail.status].tone} dot>{RECEPTION_STATUS[detail.status].label}</Badge></div>
      </div>

      {/* Rendimiento del proveedor */}
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-slate-700">Rendimiento del proveedor — {detail.supplierName}</p>
          <Badge tone={perf.tone}>{perf.ratingLabel}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-lg font-bold text-slate-800">{perf.fillRate}%</p><p className="text-[10.5px] text-slate-400">Despacho completo</p></div>
          <div><p className="text-lg font-bold text-slate-800">{perf.compliance !== null ? `${perf.compliance}%` : "—"}</p><p className="text-[10.5px] text-slate-400">Entrega a tiempo</p></div>
          <div><p className="text-lg font-bold text-rose-600">{perf.undeliveredSkus}</p><p className="text-[10.5px] text-slate-400">SKUs sin despachar (hist.)</p></div>
        </div>
        {perf.tone !== "green" && (
          <p className="text-[11px] text-amber-700 mt-2">⚠ Este proveedor no cumple siempre: despachó el {perf.fillRate}% de lo pedido en {perf.arrivedOrders} recepciones. Considera proveedor alternativo para SKUs críticos.</p>
        )}
      </div>

      {detail.qualityNote && <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{detail.qualityNote}</p>}

      <div>
        <p className="text-xs font-semibold text-slate-700 mb-2">Detalle por producto ({(detail.items ?? []).length})</p>
        {(detail.items ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Esta recepción no tiene desglose por SKU.</p>
        ) : (
          <div className="space-y-2">
            {(detail.items ?? []).map((it) => {
              const st = lineStatus(it);
              const missing = it.expected - it.received;
              return (
                <div key={it.sku} className={`rounded-lg border px-3 py-2.5 ${missing > 0 ? "border-rose-200 bg-rose-50/40" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-snug">{it.productName}</p>
                      <p className="text-xs text-slate-400 font-mono">{it.sku}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="text-slate-500">Pedido <b className="text-slate-800">{formatNumber(it.expected)}</b></span>
                    <span className="text-slate-500">Recibido <b className="text-slate-800">{formatNumber(it.received)}</b></span>
                    {missing > 0 && <span className="text-rose-600 font-semibold">Faltan {formatNumber(missing)}</span>}
                  </div>
                  {it.issue && <p className="text-xs text-rose-600 mt-1">⚠ {it.issue}</p>}
                  {missing > 0 && (
                    <Button size="sm" className="mt-2" variant={hasItem(it.sku) ? "secondary" : "primary"} disabled={hasItem(it.sku)} icon={<IconPlus className="w-3.5 h-3.5" />} onClick={() => reorder(it.sku, it.productName, detail.supplierName, missing)}>
                      {hasItem(it.sku) ? "En borrador de OC" : `Reordenar ${formatNumber(missing)} u.`}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
