import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { IconPlus, IconCampaign } from "../components/ui/icons";
import { useToast } from "../context/ToastContext";
import { useLocalStorage } from "../utils/useLocalStorage";
import { TODAY_ISO } from "../utils/constants";
import { formatCurrency, formatCurrencyCompact } from "../utils/formatters";
import { products } from "../data/mockProducts";
import {
  CAMPAIGN_PLANS,
  CHANNEL_META,
  PLACEMENT_ICON,
  PLACEMENT_LABELS,
  SPACE_TYPES,
  type CampaignPlan,
  type CampaignProduct,
  type PromoChannelKey,
  type PlacementKey,
} from "../data/mockCampaignPlans";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function Svg({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function dateShort(iso: string): string {
  if (!iso) return "—";
  const p = iso.split("-");
  return `${parseInt(p[2], 10)} ${MONTHS[parseInt(p[1], 10) - 1]}`;
}
function rangeText(from: string, to: string): string {
  if (!from || !to) return "—";
  const pf = from.split("-"), pt = to.split("-");
  if (pf[1] === pt[1]) return `${parseInt(pf[2], 10)} – ${parseInt(pt[2], 10)} ${MONTHS[parseInt(pt[1], 10) - 1]}`;
  return `${dateShort(from)} – ${dateShort(to)}`;
}
function daysUntil(iso: string): number {
  const today = new Date(`${TODAY_ISO}T00:00:00`).getTime();
  const d = new Date(`${iso}T00:00:00`).getTime();
  return Math.max(0, Math.round((d - today) / 86400000));
}
function discountPct(normal: number, promo: number): number {
  return normal > 0 && promo > 0 && promo < normal ? Math.round((1 - promo / normal) * 100) : 0;
}

const STATUS_CFG: Record<CampaignProduct["status"], { label: string; tone: "green" | "amber" | "red" }> = {
  ready: { label: "Listo", tone: "green" },
  pending: { label: "Falta creativo", tone: "amber" },
  stock_risk: { label: "Riesgo de stock", tone: "red" },
};

const CHANNEL_BG: Record<string, string> = {
  violet: "bg-violet-50 text-violet-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
};

interface ProductForm {
  mode: "add" | "edit";
  index: number;
  sku: string;
  name: string;
  category: string;
  from: string;
  to: string;
  normal: string;
  promo: string;
  channel: PromoChannelKey;
  placement: PlacementKey;
  budget: string;
  status?: CampaignProduct["status"];
  isNew?: boolean;
}

export function CampaignsPage() {
  const toast = useToast();
  const [plans, setPlans] = useLocalStorage<CampaignPlan[]>("compras:campaign-plans", CAMPAIGN_PLANS);
  const [selId, setSelId] = useState(plans[0]?.id ?? "cyber");
  const [spaceView, setSpaceView] = useState<"grid" | "calendar">("grid");
  const [chFilter, setChFilter] = useState<string>("all");
  const [form, setForm] = useState<ProductForm | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [cmName, setCmName] = useState("");
  const [cmFrom, setCmFrom] = useState("2026-06-25");
  const [cmTo, setCmTo] = useState("2026-06-30");
  const [cmBudget, setCmBudget] = useState("");

  const camp = plans.find((p) => p.id === selId) ?? plans[0];

  const updateProducts = (fn: (arr: CampaignProduct[]) => CampaignProduct[]) => {
    setPlans((prev) => prev.map((p) => (p.id === camp.id ? { ...p, products: fn([...p.products]) } : p)));
  };

  // ---- derived ----
  const allocated = camp.products.reduce((a, p) => a + p.budget, 0);
  const estSaleTotal = camp.products.reduce((a, p) => a + p.estSale, 0);
  const avgDiscount = camp.products.length
    ? Math.round(camp.products.reduce((a, p) => a + (1 - p.promo / p.normal) * 100, 0) / camp.products.length)
    : 0;
  const budgetPct = camp.totalBudget > 0 ? Math.round((allocated / camp.totalBudget) * 100) : 0;
  const overBudget = allocated > camp.totalBudget;

  const channelOrder: PromoChannelKey[] = ["redes", "ml", "web", "tienda"];

  // ---- ad spaces ----
  const spaceUsed: Record<string, number> = {};
  const spaceProducts: Record<string, CampaignProduct[]> = {};
  camp.products.forEach((p) => {
    spaceUsed[p.placement] = (spaceUsed[p.placement] ?? 0) + 1;
    (spaceProducts[p.placement] = spaceProducts[p.placement] ?? []).push(p);
  });
  const fkOf = (placement: PlacementKey, channel: PromoChannelKey) => (placement === "email" ? "email" : channel);

  const allSpaces = SPACE_TYPES.map((s) => {
    const used = spaceUsed[s.placement] ?? 0;
    const avail = Math.max(0, s.total - used);
    const assigned = (spaceProducts[s.placement] ?? []).map((p) => ({ name: p.name, disc: `-${discountPct(p.normal, p.promo)}%` }));
    return {
      ...s,
      filterKey: fkOf(s.placement, s.channel),
      used,
      avail,
      assigned,
      statusLabel: avail === 0 ? "Completo" : avail === 1 ? "Último cupo" : `${avail} libres de ${s.total}`,
      statusTone: (avail === 0 ? "red" : avail === 1 ? "amber" : "green") as "red" | "amber" | "green",
      occPct: Math.round((used / s.total) * 100),
      occBar: avail === 0 ? "#f43f5e" : avail === 1 ? "#f59e0b" : "#10b981",
    };
  });
  const spaces = chFilter === "all" ? allSpaces : allSpaces.filter((s) => s.filterKey === chFilter);
  const spacesTotal = SPACE_TYPES.reduce((a, s) => a + s.total, 0);
  const spacesUsed = allSpaces.reduce((a, s) => a + s.used, 0);
  const spacesFree = spacesTotal - spacesUsed;
  const freeByKey = (k: string) => allSpaces.filter((s) => k === "all" || s.filterKey === k).reduce((a, s) => a + s.avail, 0);

  const chips = [
    { id: "all", label: "Todos" },
    { id: "web", label: "Web" },
    { id: "tienda", label: "Tienda física" },
    { id: "ml", label: "Mercado Libre" },
    { id: "redes", label: "Redes" },
    { id: "email", label: "Email" },
  ];

  // ---- product form ----
  const retailPrice = (sku: string): { normal: number; promo: number; name: string; category: string } | null => {
    const p = products.find((x) => x.sku === sku);
    if (!p) return null;
    const r = Math.round(p.cost / (1 - (p.margin || 30) / 100) / 10) * 10;
    return { normal: r, promo: Math.round((r * 0.85) / 10) * 10, name: p.name, category: p.category };
  };

  const openAdd = (preset?: { channel: PromoChannelKey; placement: PlacementKey }) => {
    setForm({
      mode: "add", index: -1, sku: "", name: "", category: "", from: camp.from, to: camp.to,
      normal: "", promo: "", channel: preset?.channel ?? "redes", placement: preset?.placement ?? "reel", budget: "",
    });
  };
  const openEdit = (idx: number) => {
    const p = camp.products[idx];
    setForm({
      mode: "edit", index: idx, sku: p.sku, name: p.name, category: p.category, from: p.from, to: p.to,
      normal: String(p.normal), promo: String(p.promo), channel: p.channel, placement: p.placement,
      budget: String(p.budget), status: p.status, isNew: p.isNew,
    });
  };

  const fNormal = form ? parseInt(form.normal, 10) || 0 : 0;
  const fPromo = form ? parseInt(form.promo, 10) || 0 : 0;
  const fBudget = form ? parseInt(form.budget, 10) || 0 : 0;
  const fDiscount = discountPct(fNormal, fPromo);
  const fValid = !!form && !!form.sku && !!form.from && !!form.to && fNormal > 0 && fPromo > 0 && fPromo < fNormal && fBudget > 0 && form.to >= form.from;

  const submitForm = () => {
    if (!form || !fValid) {
      toast.warning("Completa producto, fechas, precios y presupuesto");
      return;
    }
    const prod: CampaignProduct = {
      name: form.name || form.sku, sku: form.sku, category: form.category,
      normal: fNormal, promo: fPromo, from: form.from, to: form.to,
      channel: form.channel, placement: form.placement, placementLabel: PLACEMENT_LABELS[form.placement],
      budget: fBudget, estSale: Math.round(fBudget * 4),
      status: form.mode === "edit" ? form.status ?? "pending" : "pending",
      isNew: form.mode === "edit" ? form.isNew : true,
    };
    if (form.mode === "edit") {
      const i = form.index;
      updateProducts((arr) => { arr[i] = prod; return arr; });
      toast.success(`Cambios guardados en ${camp.name}`);
    } else {
      updateProducts((arr) => [prod, ...arr]);
      toast.success(`${prod.name} agregado a ${camp.name} con ${fDiscount}% de descuento`);
    }
    setForm(null);
  };

  const submitCreate = () => {
    const tb = parseInt(cmBudget, 10) || 0;
    if (!cmName.trim() || !cmFrom || !cmTo || cmTo < cmFrom || tb <= 0) {
      toast.warning("Completa nombre, fechas y presupuesto");
      return;
    }
    const id = `c${Date.now()}`;
    const plan: CampaignPlan = {
      id, name: cmName.trim(), from: cmFrom, to: cmTo, totalBudget: tb,
      channelBudget: { redes: Math.round(tb * 0.4), ml: Math.round(tb * 0.3), web: Math.round(tb * 0.2), tienda: Math.round(tb * 0.1) },
      products: [],
    };
    setPlans((prev) => [...prev, plan]);
    setSelId(id);
    setCreateOpen(false);
    setCmName(""); setCmBudget("");
    toast.success(`Campaña "${plan.name}" creada`);
  };

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.sku, label: `${p.sku} — ${p.name}` })),
    []
  );

  return (
    <div>
      <PageHeader
        title="Campañas y descuentos"
        description="Arma cada evento: elige los productos en descuento, reparte el presupuesto por canal y define dónde se exhibe cada uno (reel, banner, góndola o listado destacado)."
        action={<Button icon={<IconPlus className="w-4 h-4" />} onClick={() => openAdd()}>Agregar producto</Button>}
      />

      {/* selector de campañas */}
      <div className="flex flex-wrap gap-2.5 mb-4">
        {plans.map((p) => {
          const active = p.id === selId;
          const du = daysUntil(p.from);
          return (
            <button
              key={p.id}
              onClick={() => setSelId(p.id)}
              className={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-2.5 min-w-[140px] ${active ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <span className={`text-sm font-semibold ${active ? "text-brand-700" : "text-slate-700"}`}>{p.name}</span>
              <span className={`text-xs ${active ? "text-brand-500" : "text-slate-500"}`}>{du > 0 ? `en ${du} d` : "en curso"}</span>
            </button>
          );
        })}
        <button
          onClick={() => setCreateOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 min-w-[130px] text-brand-600 hover:border-brand-400 hover:bg-brand-50/40"
        >
          <IconPlus className="w-4 h-4" />
          <span className="text-xs font-semibold">Crear campaña</span>
        </button>
      </div>

      {/* resumen */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-7">
          <div className="min-w-[200px]">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900">{camp.name}</span>
              <Badge tone="red">en {daysUntil(camp.from)} días</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{rangeText(camp.from, camp.to)} {camp.from.slice(0, 4)}</p>
          </div>
          <div className="flex gap-6 flex-wrap">
            <div><p className="text-xs text-slate-500">Productos</p><p className="text-lg font-semibold text-slate-800">{camp.products.length}</p></div>
            <div><p className="text-xs text-slate-500">Descuento prom.</p><p className="text-lg font-semibold text-rose-600">{camp.products.length ? `-${avgDiscount}%` : "—"}</p></div>
            <div><p className="text-xs text-slate-500">Venta estimada</p><p className="text-lg font-semibold text-emerald-600">{formatCurrencyCompact(estSaleTotal)}</p></div>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-xs text-slate-500">Presupuesto asignado <b className="text-slate-700">{formatCurrency(allocated)}</b> de {formatCurrencyCompact(camp.totalBudget)}</span>
              <span className="text-xs font-semibold text-slate-600">{budgetPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, budgetPct)}%`, background: overBudget ? "#f43f5e" : budgetPct > 90 ? "#f59e0b" : "#10b981" }} />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">{overBudget ? `Excede en ${formatCurrency(allocated - camp.totalBudget)}` : `Disponible ${formatCurrency(camp.totalBudget - allocated)}`}</p>
          </div>
        </CardBody>
      </Card>

      {/* presupuesto por canal */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Presupuesto por canal</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {channelOrder.map((ch) => {
          const meta = CHANNEL_META[ch];
          const budget = camp.channelBudget[ch] || 0;
          const used = camp.products.filter((p) => p.channel === ch).reduce((a, p) => a + p.budget, 0);
          const n = camp.products.filter((p) => p.channel === ch).length;
          const usePct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
          return (
            <Card key={ch}>
              <CardBody>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}><Svg path={meta.icon} className="w-4 h-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{meta.label}</p>
                    <p className="text-[11px] text-slate-500">{n} {n === 1 ? "producto" : "productos"}</p>
                  </div>
                </div>
                <p className="text-xl font-semibold text-slate-900">{formatCurrencyCompact(budget)}</p>
                <p className="text-[11px] text-slate-500 mb-2">{camp.totalBudget > 0 ? `${Math.round((budget / camp.totalBudget) * 100)}% del total` : "—"}</p>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${usePct}%`, background: "var(--bar)" }} data-tone={meta.tone} />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">{formatCurrencyCompact(used)} asignado</p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* espacios publicitarios */}
      <Card className="mb-3.5">
        <CardBody className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Svg path="M3 3h18v18H3zM3 9h18M9 21V9" className="w-6 h-6" />
            </span>
            <div>
              <p className="text-xl font-bold text-slate-900">{spacesFree} libres <span className="text-sm font-medium text-slate-500">de {spacesTotal} cupos</span></p>
              <p className="text-xs text-slate-500 mt-0.5"><b className="text-amber-700">{spacesUsed} ocupados</b> · Espacios publicitarios de esta campaña</p>
            </div>
          </div>
          <div className="flex-1 min-w-[140px] max-w-[280px]">
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((spacesFree / spacesTotal) * 100)}%` }} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">{Math.round((spacesFree / spacesTotal) * 100)}% de cupos disponibles</p>
          </div>
          <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
            {(["grid", "calendar"] as const).map((v) => (
              <button key={v} onClick={() => setSpaceView(v)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${spaceView === v ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}>
                {v === "grid" ? "Tarjetas" : "Calendario"}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* filtros por canal */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-0.5">
        {chips.map((ch) => {
          const active = chFilter === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => setChFilter(ch.id)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium border ${active ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600"}`}
            >
              {ch.label}
              <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500"}`}>{freeByKey(ch.id)}</span>
            </button>
          );
        })}
      </div>

      {/* vista tarjetas */}
      {spaceView === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-6">
          {spaces.map((s) => {
            const meta = CHANNEL_META[s.channel];
            return (
              <Card key={s.placement}>
                <CardBody className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}><Svg path={PLACEMENT_ICON[s.placement]} className="w-4 h-4" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{s.label}</p>
                        <p className="text-xs text-slate-500">{meta.label}</p>
                      </div>
                    </div>
                    <Badge tone={s.statusTone}>{s.statusLabel}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-slate-900">{s.avail}</span>
                      <span className="text-xs text-slate-500">libres de {s.total}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.occPct}%`, background: s.occBar }} /></div>
                      <p className="text-[11px] text-slate-500 mt-1">{s.used} ocupado{s.used === 1 ? "" : "s"} · {s.avail} libre{s.avail === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1.5"><Svg path="M12 21s-7-4.4-7-10a7 7 0 0 1 14 0c0 5.6-7 10-7 10z" className="w-3.5 h-3.5 text-slate-500" /> {s.position}</span>
                    <span className="flex items-center gap-1.5"><Svg path="M3 3h18v18H3zM3 9h18M9 21V9" className="w-3.5 h-3.5 text-slate-500" /> {s.size}</span>
                    <span className="flex items-center gap-1.5"><Svg path="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18" className="w-3.5 h-3.5 text-slate-500" /> {rangeText(camp.from, camp.to)}</span>
                  </div>
                  {s.assigned.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Asignados</p>
                      {s.assigned.slice(0, 2).map((a, i) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-md px-2.5 py-1.5">
                          <span className="flex-1 min-w-0 text-xs text-slate-700 truncate">{a.name}</span>
                          <span className="text-[11px] font-bold text-rose-600">{a.disc}</span>
                        </div>
                      ))}
                      {s.assigned.length > 2 && <span className="text-[11px] text-slate-500 pl-0.5">+{s.assigned.length - 2} más</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-500">
                      <IconPlus className="w-3.5 h-3.5" /> Sin asignaciones todavía
                    </div>
                  )}
                  <Button
                    variant={s.avail > 0 ? "primary" : "secondary"}
                    size="sm"
                    className="w-full"
                    icon={s.avail > 0 ? <IconPlus className="w-3.5 h-3.5" /> : undefined}
                    onClick={() => (s.avail > 0 ? openAdd({ channel: s.channel, placement: s.placement }) : toast.info(`${s.label}: ${s.assigned.map((x) => x.name).join(", ")}`))}
                  >
                    {s.avail === 0 ? "Ver asignaciones" : s.used === 0 ? "Asignar primer producto" : s.avail === 1 ? "Asignar último cupo" : "Asignar producto"}
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="mb-6">
          {spaces.map((s) => {
            const meta = CHANNEL_META[s.channel];
            return (
              <div key={s.placement} className="flex items-center gap-3.5 px-4 py-3 border-b border-slate-100 last:border-0">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}><Svg path={PLACEMENT_ICON[s.placement]} className="w-4 h-4" /></span>
                <div className="w-40 flex-shrink-0 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.label}</p>
                  <p className="text-[11px] text-slate-500">{meta.label}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="rounded-md bg-slate-100 overflow-hidden relative" style={{ height: 22 }}>
                    <div className="h-full" style={{ width: `${s.occPct}%`, background: s.occBar, opacity: 0.22 }} />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-600">{s.used} ocupado{s.used === 1 ? "" : "s"} · {s.avail} libre{s.avail === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <Badge tone={s.statusTone}>{s.statusLabel}</Badge>
                <button onClick={() => (s.avail > 0 ? openAdd({ channel: s.channel, placement: s.placement }) : undefined)} className="text-xs font-semibold text-brand-600 whitespace-nowrap">
                  {s.avail === 0 ? "Completo" : "Asignar"}
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {/* productos en descuento */}
      <p className="text-sm font-semibold text-slate-700 mb-2.5">Productos en descuento</p>
      {camp.products.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 inline-flex items-center justify-center mb-3.5"><IconCampaign className="w-6 h-6" /></div>
            <p className="text-base font-semibold text-slate-800">Aún no hay productos en esta campaña</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Agrega los productos que estarán en descuento, con su vigencia y precio.</p>
            <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => openAdd()}>Agregar producto</Button>
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-left">
                  {["Producto", "Precio antes / después", "Vigencia", "Canal y ubicación", "Presupuesto", "Venta estim.", "Estado", ""].map((h, i) => (
                    <th key={i} className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${i >= 4 && i <= 5 ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {camp.products.map((p, idx) => {
                  const meta = CHANNEL_META[p.channel];
                  const st = STATUS_CFG[p.status];
                  const disc = discountPct(p.normal, p.promo);
                  return (
                    <tr key={`${p.sku}-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800">{p.name}</span>
                          {p.isNew && <span className="rounded-full px-1.5 py-px text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">Nuevo</span>}
                        </div>
                        <p className="text-[11px] text-slate-500">{p.sku} · {p.category}</p>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[11px] text-slate-500 line-through">{formatCurrency(p.normal)}</span>
                          <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.promo)}</span>
                        </div>
                        <span className="inline-flex rounded-full px-1.5 py-px text-[11px] font-bold bg-rose-50 text-rose-600 mt-0.5">-{disc}%</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{rangeText(p.from, p.to)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}><Svg path={meta.icon} className="w-3.5 h-3.5" /></span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-700">{meta.label}</p>
                            <p className="text-[11px] text-slate-500">{p.placementLabel}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-semibold text-slate-700">{formatCurrency(p.budget)}</td>
                      <td className="px-3 py-3 text-right text-sm font-semibold text-emerald-600">{formatCurrencyCompact(p.estSale)}</td>
                      <td className="px-3 py-3"><Badge tone={st.tone}>{st.label}</Badge></td>
                      <td className="px-3 py-3">
                        <button onClick={() => openEdit(idx)} title="Editar" className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:border-brand-300 hover:text-brand-600">
                          <Svg path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal agregar/editar producto */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.mode === "edit" ? "Editar producto en descuento" : "Agregar producto en descuento"}
        description="Define el producto, la vigencia y el precio antes y después."
        size="lg"
        footer={
          <>
            {form?.mode === "edit" && (
              <Button variant="danger" onClick={() => { const i = form.index; updateProducts((arr) => arr.filter((_, j) => j !== i)); setForm(null); toast.success(`Producto quitado de ${camp.name}`); }}>Quitar</Button>
            )}
            <span className="flex-1" />
            <Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={submitForm} disabled={!fValid}>{form?.mode === "edit" ? "Guardar cambios" : "Agregar a la campaña"}</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Producto</label>
              {form.mode === "edit" ? (
                <div className="flex items-center gap-2.5 h-10 border border-slate-200 rounded-lg px-3 bg-slate-50">
                  <span className="text-[11px] font-mono text-slate-500">{form.sku}</span>
                  <span className="text-sm font-medium text-slate-700">{form.name}</span>
                </div>
              ) : (
                <Select
                  value={form.sku}
                  onChange={(e) => {
                    const sku = e.target.value;
                    const r = retailPrice(sku);
                    setForm((f) => f && { ...f, sku, name: r?.name ?? "", category: r?.category ?? "", normal: r ? String(r.normal) : f.normal, promo: r ? String(r.promo) : f.promo });
                  }}
                  options={[{ value: "", label: "Selecciona un producto…" }, ...productOptions]}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Descuento desde</label><Input type="date" value={form.from} onChange={(e) => setForm((f) => f && { ...f, from: e.target.value })} /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Descuento hasta</label><Input type="date" value={form.to} onChange={(e) => setForm((f) => f && { ...f, to: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3.5 items-end">
              <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Precio antes</label><Input inputMode="numeric" value={form.normal} onChange={(e) => setForm((f) => f && { ...f, normal: e.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></div>
              <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Precio con descuento</label><Input inputMode="numeric" value={form.promo} onChange={(e) => setForm((f) => f && { ...f, promo: e.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></div>
              <div className="text-center pb-0.5">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descuento</label>
                <span className={`inline-flex items-center justify-center min-w-[62px] h-10 rounded-lg bg-rose-50 text-base font-bold ${fDiscount > 0 ? "text-rose-600" : "text-slate-300"}`}>{fDiscount > 0 ? `-${fDiscount}%` : "—"}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Canal</label>
                <Select value={form.channel} onChange={(e) => setForm((f) => f && { ...f, channel: e.target.value as PromoChannelKey })}
                  options={[{ value: "redes", label: "Redes Sociales" }, { value: "ml", label: "Mercado Libre" }, { value: "web", label: "Web / Banner" }, { value: "tienda", label: "Tienda física" }]} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Ubicación / exhibición</label>
                <Select value={form.placement} onChange={(e) => setForm((f) => f && { ...f, placement: e.target.value as PlacementKey })}
                  options={(Object.keys(PLACEMENT_LABELS) as PlacementKey[]).map((k) => ({ value: k, label: PLACEMENT_LABELS[k] }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Presupuesto de publicidad</label>
              <div className="max-w-[220px]"><Input inputMode="numeric" value={form.budget} onChange={(e) => setForm((f) => f && { ...f, budget: e.target.value.replace(/[^0-9]/g, "") })} placeholder="0" /></div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal crear campaña */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Crear campaña"
        description="Define el evento y su presupuesto. Luego agrega los productos en descuento."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button icon={<IconPlus className="w-4 h-4" />} onClick={submitCreate}>Crear campaña</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Nombre de la campaña</label><Input value={cmName} onChange={(e) => setCmName(e.target.value)} placeholder="Ej: Cyber Septiembre" /></div>
          <div className="grid grid-cols-2 gap-3.5">
            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Desde</label><Input type="date" value={cmFrom} onChange={(e) => setCmFrom(e.target.value)} /></div>
            <div><label className="block text-xs font-semibold text-slate-600 mb-1.5">Hasta</label><Input type="date" value={cmTo} onChange={(e) => setCmTo(e.target.value)} /></div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Presupuesto total de la campaña</label>
            <div className="max-w-[240px]"><Input inputMode="numeric" value={cmBudget} onChange={(e) => setCmBudget(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" /></div>
            <p className="text-[11px] text-slate-500 mt-1.5">Se reparte automáticamente: 40% Redes, 30% Mercado Libre, 20% Web, 10% Tienda. Lo puedes ajustar después.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
