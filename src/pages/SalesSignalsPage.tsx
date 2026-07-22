import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { Drawer } from "../components/ui/Drawer";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { FilterBar } from "../components/business/FilterBar";
import { KpiCard } from "../components/business/KpiCard";
import { BarList } from "../components/business/BarList";
import { SignalDetail } from "../components/business/SignalDetail";
import { ReportSignalModal } from "../components/business/ReportSignalModal";
import {
  SIGNAL_TYPE,
  SIGNAL_STATUS,
  SIGNAL_PRIORITY,
  STOCKOUT_TYPES,
  signalKindMeta,
} from "../components/business/signalLabels";
import { useSignals } from "../context/SignalsContext";
import { useSignalsList } from "../hooks/useSignals";
import { useToast } from "../context/ToastContext";
import { formatCurrencyCompact, formatNumber } from "../utils/formatters";
import { cn } from "../utils/cn";
import { TODAY_ISO } from "../utils/constants";
import { IconSignal, IconPlus, IconCheck, IconAlerts, IconChat } from "../components/ui/icons";
import {
  describePurchaseBffError,
  type SignalBffPriority,
  type SignalBffStatus,
  type SignalView,
} from "../services/purchaseBff";
import type { SignalType } from "../types/purchasing";

// ============================================================================
//  Señales de Ventas (F13) conectadas al purchase-bff-service.
//  - Bandeja: GET /signals con filtros que resuelve el backend (pestaña =
//    status real, tipo = kind, búsqueda = q). La máquina real solo tiene
//    new → in_review → actioned | dismissed; las sub-etapas del flujo antiguo
//    (cotizado, esperando cliente, comprado…) se conversan en el hilo.
//  - KPIs, conteos y analítica salen del SignalsContext (lista completa, la
//    misma que alimenta los badges del menú y "Mi panel").
//  - El detalle (SignalDetail) pide GET /signals/:id y ejecuta los comandos.
// ============================================================================

const TABS: { value: SignalBffStatus | "all"; label: string }[] = [
  { value: "new", label: "Nuevas" },
  { value: "in_review", label: "En revisión" },
  { value: "actioned", label: "Accionadas" },
  { value: "dismissed", label: "Descartadas" },
  { value: "all", label: "Todas" },
];

const PRIORITY_ORDER: Record<SignalBffPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** ¿La señal sigue viva? (los estados terminales cierran señal e hilo). */
const isActive = (s: SignalView) => s.status === "new" || s.status === "in_review";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function daysAgo(iso: string): number {
  const today = new Date(`${TODAY_ISO}T00:00:00`).getTime();
  return Math.round((today - new Date(`${iso.slice(0, 10)}T00:00:00`).getTime()) / 86400000);
}

export function SalesSignalsPage() {
  const { signals: allSignals, configured, loading, error, refetch, report } = useSignals();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("sig");

  // Con deep-link (?sig=…) se parte en "Todas" para no perder la señal enlazada.
  const [tab, setTab] = useState<SignalBffStatus | "all">(linkedId ? "all" : "new");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [priority, setPriority] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(linkedId);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // La búsqueda la resuelve el backend: se debouncia para no pedir por tecla.
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Bandeja filtrada por el backend (status/kind/q).
  const tray = useSignalsList({
    status: tab === "all" ? undefined : tab,
    kind: kind || undefined,
    q: q || undefined,
  });

  // Conteos por pestaña y analítica: sobre la lista completa del contexto.
  const counts = useMemo(
    () => ({
      new: allSignals.filter((s) => s.status === "new").length,
      in_review: allSignals.filter((s) => s.status === "in_review").length,
      actioned: allSignals.filter((s) => s.status === "actioned").length,
      dismissed: allSignals.filter((s) => s.status === "dismissed").length,
      all: allSignals.length,
    }),
    [allSignals]
  );

  const kpiStockout = useMemo(
    () =>
      allSignals.filter(
        (s) => STOCKOUT_TYPES.includes(s.kind as SignalType) && isActive(s)
      ).length,
    [allSignals]
  );
  const kpiLostSale = useMemo(
    () =>
      allSignals
        .filter(isActive)
        .reduce((acc, s) => acc + (s.details?.estimatedLostSale ?? 0), 0),
    [allSignals]
  );

  // Analítica: qué se repite y desde dónde (con lo que trae la lista real).
  const topProducts = useMemo(
    () => aggCount(allSignals, (s) => s.sku ?? signalKindMeta(s.kind).label).slice(0, 5),
    [allSignals]
  );
  const topStores = useMemo(
    () => aggCount(allSignals.filter((s) => s.storeRef), (s) => s.storeRef as string).slice(0, 5),
    [allSignals]
  );
  const mostAsked = useMemo(
    () =>
      aggSum(
        allSignals.filter((s) => (s.details?.customersAsking ?? 0) > 0),
        (s) => s.sku ?? signalKindMeta(s.kind).label,
        (s) => s.details?.customersAsking ?? 0
      ).slice(0, 5),
    [allSignals]
  );

  // Prioridad se filtra client-side (el contrato no la expone como filtro).
  const rows = useMemo(() => {
    const base = priority ? tray.signals.filter((s) => s.priority === priority) : tray.signals;
    return [...base].sort((a, b) => {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      return a.dateCreated < b.dateCreated ? 1 : -1;
    });
  }, [tray.signals, priority]);

  const selected = rows.find((s) => s.id === selectedId) ?? rows[0];

  const clearFilters = () => {
    setQuery("");
    setKind("");
    setPriority("");
  };

  /** Refresca bandeja + contexto tras cualquier comando del detalle. */
  const handleMutated = () => {
    tray.refetch();
    refetch();
  };

  const handleReport = async (input: Parameters<typeof report>[0]) => {
    const result = await report(input);
    if (!result.ok) {
      toast.error(describePurchaseBffError(result.error));
      return;
    }
    setTab("new");
    setSelectedId(result.signal.id);
    tray.refetch();
    toast.success("Señal enviada al comprador", {
      label: "Ver señal",
      onClick: () => {
        setSelectedId(result.signal.id);
        setMobileDetail(true);
      },
    });
  };

  const pageTitle = "Señales de Ventas";
  const pageDescription =
    "Lo que el equipo de ventas detecta en el terreno: quiebres, demanda y oportunidades. Recíbelas, analízalas y decide — todo queda registrado.";

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
              ver las señales reales del equipo de ventas.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && tray.loading && allSignals.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando señales">
            {Array.from({ length: 5 }).map((_, i) => (
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

  const trayError = error ?? tray.error;
  if (trayError && allSignals.length === 0 && tray.signals.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las señales
            </p>
            <p className="mt-1 text-sm text-slate-500">{trayError.message}</p>
            <Button className="mt-4" onClick={handleMutated}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        action={
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => setReportOpen(true)}>
            Reportar señal
          </Button>
        }
      />

      {/* Flujo del proceso */}
      <FlowStrip />

      {/* Filtros (búsqueda y tipo los resuelve el backend) */}
      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por SKU o texto de la señal"
          resultCount={rows.length}
          summary={`${rows.length} señal${rows.length === 1 ? "" : "es"} en la vista · ${counts.new} nueva${counts.new === 1 ? "" : "s"} · ${kpiStockout} de quiebre activas`}
          onClear={clearFilters}
          selects={[
            {
              key: "kind",
              placeholder: "Tipo de señal",
              value: kind,
              onChange: setKind,
              options: (Object.keys(SIGNAL_TYPE) as SignalType[]).map((t) => ({
                value: t,
                label: SIGNAL_TYPE[t].label,
              })),
            },
            {
              key: "priority",
              placeholder: "Prioridad",
              value: priority,
              onChange: setPriority,
              options: (["high", "medium", "low"] as SignalBffPriority[]).map((p) => ({
                value: p,
                label: SIGNAL_PRIORITY[p].label,
              })),
            },
          ]}
        />
      </div>

      {/* KPIs (la máquina real: nuevas / en revisión / accionadas + quiebre y venta perdida) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard
          title="Nuevas"
          value={formatNumber(counts.new)}
          tone="info"
          icon={<IconSignal className="w-4 h-4" />}
          description="Sin revisar"
          active={tab === "new"}
          onClick={() => setTab("new")}
        />
        <KpiCard
          title="En revisión"
          value={formatNumber(counts.in_review)}
          tone="warn"
          icon={<IconChat className="w-4 h-4" />}
          description="En manos del comprador"
          active={tab === "in_review"}
          onClick={() => setTab("in_review")}
        />
        <KpiCard
          title="Quiebres activos"
          value={formatNumber(kpiStockout)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Señales de quiebre vivas"
        />
        <KpiCard
          title="Accionadas"
          value={formatNumber(counts.actioned)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
          description="Ver accionadas"
          active={tab === "actioned"}
          onClick={() => setTab("actioned")}
        />
        <KpiCard
          title="Venta perdida est."
          value={formatCurrencyCompact(kpiLostSale)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="En señales activas"
        />
      </div>

      {/* Analítica: qué se repite, qué tiendas, qué se pide */}
      <Card className="mb-4">
        <CardHeader
          title="Resumen de señales"
          description="Qué productos y tiendas concentran lo que ventas está reportando."
        />
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <MiniBar
              title="Top productos reportados"
              empty="Sin señales"
              items={topProducts.map((x) => ({
                label: x.label,
                value: x.value,
                display: `${x.value}`,
                tone: "blue",
              }))}
            />
            <MiniBar
              title="Top tiendas con señales"
              empty="Sin señales"
              items={topStores.map((x) => ({
                label: x.label,
                value: x.value,
                display: `${x.value}`,
                tone: "violet",
              }))}
            />
            <MiniBar
              title="Productos más solicitados"
              empty="Sin solicitudes registradas"
              items={mostAsked.map((x) => ({
                label: x.label,
                value: x.value,
                display: `${x.value} clientes`,
                tone: "amber",
              }))}
            />
          </div>
        </CardBody>
      </Card>

      {/* Tabs = estados reales de la máquina */}
      <div className="mb-4">
        <Tabs
          tabs={TABS.map((t) => ({ ...t, count: counts[t.value] }))}
          value={tab}
          onChange={(v) => setTab(v as SignalBffStatus | "all")}
        />
      </div>

      {tray.loading && rows.length === 0 ? (
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando señales">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<IconSignal className="w-6 h-6" />}
              title="No hay señales en esta vista"
              description="Ajusta los filtros o reporta una nueva señal desde el terreno."
              action={
                <Button
                  variant="secondary"
                  icon={<IconPlus className="w-4 h-4" />}
                  onClick={() => setReportOpen(true)}
                >
                  Reportar señal
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-[minmax(330px,400px)_1fr] gap-4">
          {/* Bandeja */}
          <div className="space-y-3 lg:max-h-[74vh] lg:overflow-y-auto no-scrollbar lg:pr-1">
            {groupByTime(rows).map((bucket) => (
              <div key={bucket.key}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1 mb-1.5">
                  {bucket.label}
                </p>
                <div className="space-y-1.5">
                  {bucket.items.map((s) => (
                    <SignalRow
                      key={s.id}
                      signal={s}
                      selected={selected?.id === s.id}
                      onClick={() => {
                        setSelectedId(s.id);
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
            {selected && <SignalDetail id={selected.id} onMutated={handleMutated} />}
          </div>
        </div>
      )}

      {/* Detalle móvil */}
      <Drawer
        open={mobileDetail && !!selected}
        onClose={() => setMobileDetail(false)}
        title="Detalle de la señal"
      >
        {selected && <SignalDetail id={selected.id} onMutated={handleMutated} />}
      </Drawer>

      <ReportSignalModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReport}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------

function aggCount(signals: SignalView[], key: (s: SignalView) => string) {
  const map = new Map<string, number>();
  for (const s of signals) map.set(key(s), (map.get(key(s)) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function aggSum(
  signals: SignalView[],
  key: (s: SignalView) => string,
  val: (s: SignalView) => number
) {
  const map = new Map<string, number>();
  for (const s of signals) map.set(key(s), (map.get(key(s)) ?? 0) + val(s));
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function MiniBar({
  title,
  items,
  empty,
}: {
  title: string;
  items: { label: string; value: number; display: string; tone: "blue" | "violet" | "amber" }[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-600 mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{empty}</p>
      ) : (
        <BarList items={items} />
      )}
    </div>
  );
}

function FlowStrip() {
  const steps = [
    "Ventas reporta",
    "Comprador recibe",
    "Analiza con datos",
    "Decide",
    "Queda registrado",
  ];
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1 text-xs">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 px-2.5 py-1">
            <span className="w-4 h-4 rounded-full bg-white text-slate-500 text-[10px] font-semibold flex items-center justify-center">
              {i + 1}
            </span>
            {s}
          </span>
          {i < steps.length - 1 && <span className="text-slate-300">›</span>}
        </div>
      ))}
    </div>
  );
}

function SignalRow({
  signal,
  selected,
  onClick,
}: {
  signal: SignalView;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = signalKindMeta(signal.kind);
  const status = SIGNAL_STATUS[signal.status];
  const unread = signal.status === "new";
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
        <Badge tone={SIGNAL_PRIORITY[signal.priority].tone}>
          {SIGNAL_PRIORITY[signal.priority].label}
        </Badge>
        <Badge tone={meta.tone}>{meta.short}</Badge>
        <span
          className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded px-1.5 py-0.5"
          title="Reportada desde el terreno por el equipo de ventas (no es una alerta automática del sistema)"
        >
          Terreno
        </span>
        {unread && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" title="Sin revisar" />}
        <div className="flex-1" />
        <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(signal.dateCreated)}</span>
      </div>
      <p
        className={cn(
          "text-sm truncate",
          unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
        )}
      >
        {signal.sku ?? meta.label}
      </p>
      <p className="text-xs text-slate-500 line-clamp-2">{signal.body}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        <span className="text-xs text-slate-400 truncate">
          {[signal.storeRef, signal.reporterName ?? signal.reporterUserId]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {(signal.messageCount ?? 0) > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400 flex-shrink-0">
            <IconChat className="w-3.5 h-3.5" /> {signal.messageCount}
          </span>
        )}
      </div>
    </div>
  );
}

/** Agrupa señales por antigüedad (Hoy / Ayer / Esta semana / Anteriores). */
function groupByTime(items: SignalView[]) {
  const buckets: { key: string; label: string; items: SignalView[] }[] = [
    { key: "hoy", label: "Hoy", items: [] },
    { key: "ayer", label: "Ayer", items: [] },
    { key: "semana", label: "Esta semana", items: [] },
    { key: "antes", label: "Anteriores", items: [] },
  ];
  for (const s of items) {
    const d = daysAgo(s.dateCreated);
    if (d <= 0) buckets[0].items.push(s);
    else if (d === 1) buckets[1].items.push(s);
    else if (d <= 7) buckets[2].items.push(s);
    else buckets[3].items.push(s);
  }
  return buckets.filter((b) => b.items.length > 0);
}
