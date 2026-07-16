import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { imports as seedImports, IMPORT_STAGE, IMPORT_PIPELINE } from "../data/mockImports";
import { importLanded, daysToEta } from "../utils/importCost";
import { TODAY_ISO } from "../utils/constants";
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "../utils/formatters";
import { cn } from "../utils/cn";
import { IconTruck, IconClock, IconCheck, IconClose, IconDownload } from "../components/ui/icons";
import type { ImportOrder } from "../types/purchasing";

const whenEta = (d: number) =>
  d < 0 ? `hace ${-d}d` : d === 0 ? "hoy" : d === 1 ? "mañana" : `en ${d}d`;

export function ImportsPage() {
  const [detail, setDetail] = useState<ImportOrder | null>(null);

  const active = useMemo(() => seedImports.filter((i) => i.stage !== "bodega"), []);
  const kpis = useMemo(() => {
    const capital = active.reduce((a, i) => a + importLanded(i).landed, 0);
    const docsPend = active.reduce((a, i) => a + i.docs.filter((d) => !d.ok).length, 0);
    const next = [...active].sort((a, b) => (a.eta < b.eta ? -1 : 1))[0];
    return { count: active.length, capital, docsPend, next };
  }, [active]);

  return (
    <div>
      <PageHeader
        title="Compras importadas"
        description="Torre de control de importaciones: proceso, fechas (ETD/ETA), documentos y costo puesto en bodega."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Importaciones en curso"
          value={String(kpis.count)}
          tone="info"
          icon={<IconTruck className="w-4 h-4" />}
        />
        <KpiCard
          title="Capital en importación"
          value={formatCurrencyCompact(kpis.capital)}
          tone="warn"
          icon={<IconTruck className="w-4 h-4" />}
          description="Costo puesto en bodega estimado"
        />
        <KpiCard
          title="Próxima llegada"
          value={kpis.next ? formatDate(kpis.next.eta) : "—"}
          tone="info"
          icon={<IconClock className="w-4 h-4" />}
          description={kpis.next ? kpis.next.supplierName : undefined}
        />
        <KpiCard
          title="Documentos pendientes"
          value={String(kpis.docsPend)}
          tone={kpis.docsPend > 0 ? "bad" : "good"}
          icon={<IconDownload className="w-4 h-4" />}
        />
      </div>

      <div className="space-y-3">
        {seedImports.map((imp) => {
          const cost = importLanded(imp);
          const d = daysToEta(imp.eta, TODAY_ISO);
          const st = IMPORT_STAGE[imp.stage];
          const docsPend = imp.docs.filter((x) => !x.ok).length;
          return (
            <Card key={imp.id}>
              <button
                type="button"
                onClick={() => setDetail(imp)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={st.tone} dot>
                        {st.label}
                      </Badge>
                      <span className="text-xs font-mono text-slate-400">{imp.id}</span>
                      <span className="text-xs text-slate-400">· {imp.incoterm}</span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{imp.supplierName}</p>
                    <p className="text-xs text-slate-500">
                      {imp.origen} → {imp.puerto} · {imp.contenedor} · {formatNumber(imp.skuCount)}{" "}
                      SKU
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-1 lg:flex-shrink-0">
                    <div className="text-sm">
                      <p className="text-xs text-slate-400">ETA</p>
                      <p className="font-medium text-slate-800">
                        {formatDate(imp.eta)}{" "}
                        <span className={cn("text-xs", d < 0 ? "text-rose-600" : "text-slate-400")}>
                          ({whenEta(d)})
                        </span>
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-xs text-slate-400">Puesto en bodega</p>
                      <p className="font-semibold text-slate-900">
                        {formatCurrencyCompact(cost.landed)}
                      </p>
                    </div>
                    {docsPend > 0 && (
                      <Badge tone="amber">
                        {docsPend} doc{docsPend === 1 ? "" : "s"} pend.
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            </Card>
          );
        })}
      </div>

      {detail && <ImportDetailModal imp={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ImportDetailModal({ imp, onClose }: { imp: ImportOrder; onClose: () => void }) {
  const [tc, setTc] = useState(imp.tipoCambio);
  const base = importLanded(imp);
  const sim = importLanded(imp, tc);
  const delta = sim.landed - base.landed;

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`${imp.id} · ${imp.supplierName}`}
      description={`${imp.origen} → ${imp.puerto} · ${imp.incoterm} · ${imp.contenedor}`}
    >
      <div className="space-y-4">
        {/* Pipeline */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {IMPORT_PIPELINE.map((stage) => {
            const s = IMPORT_STAGE[stage];
            const done = s.order < IMPORT_STAGE[imp.stage].order;
            const current = stage === imp.stage;
            return (
              <div key={stage} className="flex items-center gap-1 flex-shrink-0">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
                    current
                      ? "bg-brand-600 text-white"
                      : done
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                  )}
                >
                  {s.short}
                </span>
                {stage !== "bodega" && <span className="text-slate-300">›</span>}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Field label="Naviera" value={imp.naviera} />
          <Field label="ETD" value={formatDate(imp.etd)} />
          <Field label="ETA" value={formatDate(imp.eta)} />
          <Field label="En bodega (est.)" value={imp.fechaBodega ? formatDate(imp.fechaBodega) : "—"} />
          <Field label="Moneda" value={imp.moneda} />
          <Field label="FOB" value={`${imp.moneda} ${formatNumber(imp.montoFob)}`} />
          <Field label="Anticipo" value={`${imp.anticipoPct}%`} />
          <Field label="OC asociada" value={imp.poNumber} />
        </div>

        {/* Simulador de costo puesto en bodega */}
        <div className="rounded-xl border border-slate-200 p-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Costo puesto en bodega</p>
              <p className="text-xs text-slate-500">
                Se recalcula con el tipo de cambio, flete, arancel y gastos de internación.
              </p>
            </div>
            <label className="block text-xs text-slate-500">
              Simular tipo de cambio (CLP/{imp.moneda})
              <Input
                type="number"
                min={0}
                value={tc}
                onChange={(e) => setTc(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-40"
              />
            </label>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <Row label={`FOB (${imp.moneda} ${formatNumber(imp.montoFob)} × ${formatNumber(tc)})`} value={sim.fobClp} />
            <Row label={`Arancel (${imp.arancelPct}%)`} value={sim.arancel} />
            <Row label="Flete internacional" value={sim.flete} />
            <Row label="Gastos portuarios" value={sim.portuarios} />
            <Row label="Transporte terrestre" value={sim.terrestre} />
            <Row label="Agente de aduana" value={sim.aduana} />
            <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
              <span className="text-sm font-medium text-slate-600">
                Puesto en bodega
                <span className="ml-1 text-xs text-slate-400">
                  (+{Math.round(sim.extraPct)}% sobre FOB)
                </span>
              </span>
              <span className="text-base font-semibold text-slate-900">
                {formatCurrency(sim.landed)}
              </span>
            </div>
            {delta !== 0 && (
              <p
                className={cn(
                  "text-right text-xs font-medium",
                  delta > 0 ? "text-rose-600" : "text-emerald-600"
                )}
              >
                {delta > 0 ? "+" : "−"}
                {formatCurrency(Math.abs(delta))} vs tipo de cambio actual (
                {formatNumber(imp.tipoCambio)})
              </p>
            )}
          </div>
        </div>

        {/* Documentación */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Documentación
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {imp.docs.map((doc) => (
              <div
                key={doc.nombre}
                className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-1.5 text-sm"
              >
                {doc.ok ? (
                  <IconCheck className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                ) : (
                  <IconClose className="h-4 w-4 flex-shrink-0 text-amber-500" />
                )}
                <span className={doc.ok ? "text-slate-700" : "text-amber-700"}>{doc.nombre}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-700">{formatCurrency(value)}</span>
    </div>
  );
}
