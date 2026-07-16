import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { Drawer } from "../components/ui/Drawer";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { FilterBar } from "../components/business/FilterBar";
import { KpiCard } from "../components/business/KpiCard";
import { BarList } from "../components/business/BarList";
import { SignalDetail } from "../components/business/SignalDetail";
import {
  ReportSignalModal,
  type ReportSignalDefaults,
} from "../components/business/ReportSignalModal";
import {
  SIGNAL_TYPE,
  SIGNAL_STATUS,
  SIGNAL_PRIORITY,
  SIGNAL_CHANNEL,
  STOCKOUT_TYPES,
} from "../components/business/signalLabels";
import { useSignals } from "../context/SignalsContext";
import { useBuyer } from "../context/BuyerContext";
import { useToast } from "../context/ToastContext";
import { formatCurrencyCompact, formatNumber } from "../utils/formatters";
import { cn } from "../utils/cn";
import { inRange, type IsoRange } from "../utils/dateRange";
import { TODAY_ISO } from "../utils/constants";
import { IconSignal, IconPlus, IconCheck, IconAlerts, IconChat } from "../components/ui/icons";
import type { SalesSignal, SignalChannel, SignalPriority, SignalType } from "../types/purchasing";

const TABS = [
  { value: "to_review", label: "Por revisar" },
  { value: "in_progress", label: "En gestión" },
  { value: "accepted", label: "Aprobadas" },
  { value: "resolved", label: "Resueltas" },
  { value: "rejected", label: "Rechazadas" },
  { value: "all", label: "Todas" },
];

const IN_PROGRESS_STATUSES = ["sourcing", "quoted", "awaiting_customer", "purchased"];

const PRIORITY_ORDER: Record<SignalPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function daysAgo(iso: string): number {
  const today = new Date(`${TODAY_ISO}T00:00:00`).getTime();
  return Math.round((today - new Date(`${iso.slice(0, 10)}T00:00:00`).getTime()) / 86400000);
}

export function SalesSignalsPage() {
  const { signals, addSignal } = useSignals();
  const { buyer } = useBuyer();
  const toast = useToast();

  const [tab, setTab] = useState("to_review");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState("");
  const [type, setType] = useState("");
  const [channel, setChannel] = useState("");
  const [store, setStore] = useState("");
  const [category, setCategory] = useState("");
  const [assigned, setAssigned] = useState("");
  const [dates, setDates] = useState<IsoRange>({ from: "", to: "" });
  const [onlyStockout, setOnlyStockout] = useState(false);
  const [mine, setMine] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDefaults] = useState<ReportSignalDefaults | undefined>(undefined);

  const stores = useMemo(
    () => Array.from(new Set(signals.map((s) => s.store))).sort((a, b) => a.localeCompare(b, "es")),
    [signals]
  );
  const categories = useMemo(
    () =>
      Array.from(new Set(signals.map((s) => s.category))).sort((a, b) => a.localeCompare(b, "es")),
    [signals]
  );
  const assignees = useMemo(
    () =>
      Array.from(new Set(signals.map((s) => s.assignedBuyer).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [signals]
  );

  // Filtros (sin la pestaña): controlan KPIs, analítica y conteos.
  const byFilters = useMemo(() => {
    const q = query.trim().toLowerCase();
    return signals.filter((s) => {
      if (
        q &&
        !s.productName.toLowerCase().includes(q) &&
        !(s.sku ?? "").toLowerCase().includes(q) &&
        !s.category.toLowerCase().includes(q) &&
        !s.reportedBy.toLowerCase().includes(q)
      )
        return false;
      if (priority && s.priority !== priority) return false;
      if (type && s.type !== type) return false;
      if (channel && s.channel !== channel) return false;
      if (store && s.store !== store) return false;
      if (category && s.category !== category) return false;
      if (assigned && s.assignedBuyer !== assigned) return false;
      if (mine && s.assignedBuyer !== buyer) return false;
      if (onlyStockout && !STOCKOUT_TYPES.includes(s.type)) return false;
      if (!inRange(s.date, dates)) return false;
      return true;
    });
  }, [
    signals,
    query,
    priority,
    type,
    channel,
    store,
    category,
    assigned,
    mine,
    onlyStockout,
    dates,
    buyer,
  ]);

  const counts = useMemo(
    () => ({
      to_review: byFilters.filter((s) => s.status === "new" || s.status === "in_review").length,
      in_progress: byFilters.filter((s) => IN_PROGRESS_STATUSES.includes(s.status)).length,
      accepted: byFilters.filter((s) => s.status === "accepted").length,
      resolved: byFilters.filter((s) => s.status === "resolved").length,
      rejected: byFilters.filter((s) => s.status === "rejected").length,
      all: byFilters.length,
    }),
    [byFilters]
  );

  // KPIs
  const kpiNew = byFilters.filter((s) => s.status === "new").length;
  const kpiStockout = byFilters.filter(
    (s) => STOCKOUT_TYPES.includes(s.type) && s.status !== "resolved" && s.status !== "rejected"
  ).length;
  const kpiPending = counts.to_review;
  const kpiAccepted = counts.accepted;
  const kpiLostSale = byFilters
    .filter((s) => s.status !== "resolved" && s.status !== "rejected")
    .reduce((acc, s) => acc + (s.estimatedLostSale ?? 0), 0);

  // Analítica
  const topProducts = useMemo(
    () => aggCount(byFilters, (s) => s.productName).slice(0, 5),
    [byFilters]
  );
  const topStores = useMemo(() => aggCount(byFilters, (s) => s.store).slice(0, 5), [byFilters]);
  const mostAsked = useMemo(
    () =>
      aggSum(
        byFilters.filter((s) => (s.customersAsking ?? 0) > 0),
        (s) => s.productName,
        (s) => s.customersAsking ?? 0
      ).slice(0, 5),
    [byFilters]
  );

  // Listado por pestaña
  const filtered = useMemo(() => {
    let base = byFilters;
    if (tab === "to_review")
      base = base.filter((s) => s.status === "new" || s.status === "in_review");
    else if (tab === "in_progress")
      base = base.filter((s) => IN_PROGRESS_STATUSES.includes(s.status));
    else if (tab !== "all") base = base.filter((s) => s.status === tab);
    return [...base].sort((a, b) => {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      return a.date < b.date ? 1 : -1;
    });
  }, [byFilters, tab]);

  const selected = filtered.find((s) => s.id === selectedId) ?? filtered[0];

  const clearFilters = () => {
    setQuery("");
    setPriority("");
    setType("");
    setChannel("");
    setStore("");
    setCategory("");
    setAssigned("");
    setDates({ from: "", to: "" });
    setOnlyStockout(false);
    setMine(false);
  };

  const handleReport = (input: Parameters<typeof addSignal>[0]) => {
    const created = addSignal(input);
    setTab("to_review");
    setSelectedId(created.id);
    toast.success("Señal enviada al comprador", {
      label: "Ver señal",
      onClick: () => {
        setSelectedId(created.id);
        setMobileDetail(true);
      },
    });
  };

  return (
    <div>
      <PageHeader
        title="Señales de Ventas"
        description="Lo que el equipo de ventas detecta en el terreno: quiebres, demanda y oportunidades. Recíbelas, analízalas y decide — todo queda registrado."
        action={
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => setReportOpen(true)}>
            Reportar señal
          </Button>
        }
      />

      {/* Flujo del proceso */}
      <FlowStrip />

      {/* Filtros */}
      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar por producto, SKU, categoría o vendedor"
          resultCount={byFilters.length}
          summary={`${byFilters.length} señal${byFilters.length === 1 ? "" : "es"} · ${kpiPending} por revisar · ${kpiStockout} de quiebre`}
          onClear={clearFilters}
          toggles={[
            {
              key: "mine",
              label: "Asignadas a mí",
              active: mine,
              onToggle: () => setMine((v) => !v),
            },
            {
              key: "stockout",
              label: "Sólo quiebres",
              active: onlyStockout,
              onToggle: () => setOnlyStockout((v) => !v),
            },
          ]}
          selects={[
            {
              key: "priority",
              placeholder: "Prioridad",
              value: priority,
              onChange: setPriority,
              options: (["high", "medium", "low"] as SignalPriority[]).map((p) => ({
                value: p,
                label: SIGNAL_PRIORITY[p].label,
              })),
            },
            {
              key: "type",
              placeholder: "Tipo de señal",
              value: type,
              onChange: setType,
              options: (Object.keys(SIGNAL_TYPE) as SignalType[]).map((t) => ({
                value: t,
                label: SIGNAL_TYPE[t].label,
              })),
            },
            {
              key: "channel",
              placeholder: "Canal",
              value: channel,
              onChange: setChannel,
              options: (Object.keys(SIGNAL_CHANNEL) as SignalChannel[]).map((c) => ({
                value: c,
                label: SIGNAL_CHANNEL[c],
              })),
            },
            {
              key: "store",
              placeholder: "Tienda / punto",
              value: store,
              onChange: setStore,
              options: stores.map((s) => ({ value: s, label: s })),
            },
            {
              key: "category",
              placeholder: "Categoría",
              value: category,
              onChange: setCategory,
              options: categories.map((c) => ({ value: c, label: c })),
            },
            {
              key: "assigned",
              placeholder: "Comprador",
              value: assigned,
              onChange: setAssigned,
              options: assignees.map((b) => ({ value: b, label: b })),
            },
          ]}
          dateRange={{ value: dates, onChange: setDates, label: "Fecha de la señal" }}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard
          title="Nuevas"
          value={formatNumber(kpiNew)}
          tone="info"
          icon={<IconSignal className="w-4 h-4" />}
          description="Ver por revisar"
          active={tab === "to_review"}
          onClick={() => setTab("to_review")}
        />
        <KpiCard
          title="Quiebres reportados"
          value={formatNumber(kpiStockout)}
          tone="bad"
          icon={<IconAlerts className="w-4 h-4" />}
          description="Filtrar quiebres"
          active={onlyStockout}
          onClick={() => {
            setOnlyStockout((v) => !v);
            setTab("to_review");
          }}
        />
        <KpiCard
          title="Por revisar"
          value={formatNumber(kpiPending)}
          tone="warn"
          icon={<IconChat className="w-4 h-4" />}
          description="Pendientes de decisión"
          active={tab === "to_review" && !onlyStockout}
          onClick={() => {
            setTab("to_review");
            setOnlyStockout(false);
          }}
        />
        <KpiCard
          title="Aceptadas"
          value={formatNumber(kpiAccepted)}
          tone="good"
          icon={<IconCheck className="w-4 h-4" />}
          description="Ver aceptadas"
          active={tab === "accepted"}
          onClick={() => setTab("accepted")}
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

      {/* Tabs */}
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
            {groupByTime(filtered).map((bucket) => (
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
                      mine={s.assignedBuyer === buyer}
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
          <div className="hidden lg:block">{selected && <SignalDetail signal={selected} />}</div>
        </div>
      )}

      {/* Detalle móvil */}
      <Drawer
        open={mobileDetail && !!selected}
        onClose={() => setMobileDetail(false)}
        title="Detalle de la señal"
      >
        {selected && <SignalDetail signal={selected} />}
      </Drawer>

      <ReportSignalModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReport}
        defaults={reportDefaults}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------

function aggCount(signals: SalesSignal[], key: (s: SalesSignal) => string) {
  const map = new Map<string, number>();
  for (const s of signals) map.set(key(s), (map.get(key(s)) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function aggSum(
  signals: SalesSignal[],
  key: (s: SalesSignal) => string,
  val: (s: SalesSignal) => number
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
  mine,
  onClick,
}: {
  signal: SalesSignal;
  selected: boolean;
  mine: boolean;
  onClick: () => void;
}) {
  const meta = SIGNAL_TYPE[signal.type];
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
        {mine && <Badge tone="violet">Para mí</Badge>}
        <div className="flex-1" />
        <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(signal.date)}</span>
      </div>
      <p
        className={cn(
          "text-sm truncate",
          unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"
        )}
      >
        {signal.productName}
      </p>
      <p className="text-xs text-slate-500 line-clamp-2">{signal.comment}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <Badge tone={status.tone} dot>
          {status.label}
        </Badge>
        <span className="text-xs text-slate-400 truncate">
          {SIGNAL_CHANNEL[signal.channel]} · {signal.store}
        </span>
      </div>
    </div>
  );
}

/** Agrupa señales por antigüedad (Hoy / Ayer / Esta semana / Anteriores). */
function groupByTime(items: SalesSignal[]) {
  const buckets: { key: string; label: string; items: SalesSignal[] }[] = [
    { key: "hoy", label: "Hoy", items: [] },
    { key: "ayer", label: "Ayer", items: [] },
    { key: "semana", label: "Esta semana", items: [] },
    { key: "antes", label: "Anteriores", items: [] },
  ];
  for (const s of items) {
    const d = daysAgo(s.date);
    if (d <= 0) buckets[0].items.push(s);
    else if (d === 1) buckets[1].items.push(s);
    else if (d <= 7) buckets[2].items.push(s);
    else buckets[3].items.push(s);
  }
  return buckets.filter((b) => b.items.length > 0);
}
