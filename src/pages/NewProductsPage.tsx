import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Tabs } from "../components/ui/Tabs";
import { EmptyState } from "../components/ui/EmptyState";
import { productIntros, NPI_STAGE, npiMargin, type ProductIntro } from "../data/mockNpi";
import { exitCandidates } from "../utils/assortment";
import { products } from "../data/mockProducts";
import { productPath } from "../utils/entityLinks";
import { useToast } from "../context/ToastContext";
import { useTrace } from "../context/TraceContext";
import { TODAY_ISO } from "../utils/constants";
import { formatCurrency, formatNumber, formatPercent } from "../utils/formatters";
import { IconBulb, IconCheck } from "../components/ui/icons";

const RISK_TONE = { bajo: "green", medio: "amber", alto: "red" } as const;

export function NewProductsPage() {
  const [tab, setTab] = useState("altas");
  const [detail, setDetail] = useState<ProductIntro | null>(null);
  const exits = useMemo(() => exitCandidates(products), []);
  const { log } = useTrace();
  const toast = useToast();
  const [scheduled, setScheduled] = useState<Set<string>>(new Set());

  const activeNpi = productIntros.filter((p) => p.stage !== "rechazada" && p.stage !== "escalado");

  const scheduleExit = (sku: string, name: string) => {
    setScheduled((prev) => new Set(prev).add(sku));
    log({
      actor: "Catalina Saavedra",
      entity: `Producto · ${name}`,
      action: "Programó salida del surtido",
      reason: "Bloquear nuevas compras y liquidar stock restante",
      date: TODAY_ISO,
    });
    toast.success(`${name}: salida programada · compras bloqueadas`);
  };

  return (
    <div>
      <PageHeader
        title="Nuevos productos y surtido"
        description="Incorporación de productos (piloto → escalado) y salidas del surtido (line review)."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="En incorporación" value={String(activeNpi.length)} tone="info" icon={<IconBulb className="w-4 h-4" />} />
        <KpiCard
          title="En piloto"
          value={String(productIntros.filter((p) => p.stage === "piloto").length)}
          tone="warn"
        />
        <KpiCard
          title="Escalados"
          value={String(productIntros.filter((p) => p.stage === "escalado").length)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
        />
        <KpiCard title="Candidatos a salida" value={String(exits.length)} tone="bad" />
      </div>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "altas", label: "Incorporación", count: productIntros.length },
          { value: "salidas", label: "Salidas", count: exits.length },
        ]}
      />

      {tab === "altas" && (
        <div className="space-y-3">
          {productIntros.map((p) => {
            const st = NPI_STAGE[p.stage];
            return (
              <Card key={p.id}>
                <button
                  type="button"
                  onClick={() => setDetail(p)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone} dot>
                          {st.label}
                        </Badge>
                        <Badge tone={RISK_TONE[p.risk]}>Riesgo {p.risk}</Badge>
                        <span className="text-xs font-mono text-slate-400">{p.id}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.category} · {p.supplierName} · comparable: {p.comparable}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 lg:flex-shrink-0">
                      <MiniField label="Margen" value={formatPercent(npiMargin(p), 0)} />
                      <MiniField label="Compra inicial" value={`${formatNumber(p.initialBuy)} u.`} />
                      <MiniField label="Piloto" value={`${p.pilotStores} tiendas`} />
                      <MiniField label="Pronóstico" value={`${formatNumber(p.initialForecast)}/mes`} />
                    </div>
                  </div>
                  {p.pilotResult && (
                    <p className="mt-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Piloto:</span> {p.pilotResult}
                    </p>
                  )}
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "salidas" && (
        <Card>
          <CardHeader
            title="Candidatos a salida del surtido"
            description="Sin venta, descontinuados o baja rotación: programar salida bloquea nuevas compras y liquida el stock."
          />
          <CardBody>
            {exits.length === 0 ? (
              <EmptyState title="Sin candidatos a salida" description="El surtido está sano." />
            ) : (
              <div className="space-y-2">
                {exits.slice(0, 20).map((e) => (
                  <div
                    key={e.sku}
                    className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <Link
                        to={productPath(e.sku)}
                        className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {e.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {e.category} · {e.reason} · stock restante {formatNumber(e.availableStock)} u.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={scheduled.has(e.sku) ? "secondary" : "primary"}
                      disabled={scheduled.has(e.sku)}
                      onClick={() => scheduleExit(e.sku, e.name)}
                    >
                      {scheduled.has(e.sku) ? "Salida programada" : "Programar salida"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {detail && <NpiDetailModal p={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function NpiDetailModal({ p, onClose }: { p: ProductIntro; onClose: () => void }) {
  const stages: ProductIntro["stage"][] = ["propuesta", "aprobada", "piloto", "evaluacion", "escalado"];
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={p.name}
      description={`${p.id} · ${p.category} · ${p.supplierName}`}
    >
      <div className="space-y-4">
        {/* Pipeline */}
        <div className="flex flex-wrap items-center gap-1">
          {stages.map((s, i) => {
            const meta = NPI_STAGE[s];
            const done = meta.order < NPI_STAGE[p.stage].order;
            const current = s === p.stage;
            return (
              <div key={s} className="flex items-center gap-1">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    current
                      ? "bg-brand-600 text-white"
                      : done
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {meta.label}
                </span>
                {i < stages.length - 1 && <span className="text-slate-300">›</span>}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          <DField label="Costo" value={formatCurrency(p.cost)} />
          <DField label="Precio sugerido" value={formatCurrency(p.suggestedPrice)} />
          <DField label="Margen" value={formatPercent(npiMargin(p), 0)} />
          <DField label="Compra inicial" value={`${formatNumber(p.initialBuy)} u.`} />
          <DField label="Tiendas piloto" value={String(p.pilotStores)} />
          <DField label="Pronóstico inicial" value={`${formatNumber(p.initialForecast)}/mes`} />
          <DField label="Riesgo" value={p.risk} />
          <DField label="Comprador" value={p.buyer} />
          <DField label="Comparable" value={p.comparable} />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Mercado objetivo
          </p>
          <p className="mt-1 text-sm text-slate-700">{p.targetMarket}</p>
        </div>

        {p.pilotResult && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resultado del piloto
            </p>
            <p className="mt-1 text-sm text-slate-700">{p.pilotResult}</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function DField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
