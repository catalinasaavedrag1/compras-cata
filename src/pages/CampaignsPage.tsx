import { useMemo, useState } from "react";
import { CampaignPerformance } from "./CampaignPerformance";
import {
  CampaignSummaryCard,
  ChannelBudgetGrid,
  AdSpacesHeader,
  ChannelFilterChips,
  AdSpacesView,
  CampaignProductsTable,
} from "./CampaignsSections";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Tabs } from "../components/ui/Tabs";
import { IconPlus } from "../components/ui/icons";
import { useToast } from "../context/ToastContext";
import { useLocalStorage } from "../utils/useLocalStorage";

import { products } from "../data/mockProducts";
import { CAMPAIGN_PLANS, PLACEMENT_LABELS, SPACE_TYPES, type CampaignPlan, type CampaignProduct, type PromoChannelKey, type PlacementKey } from "../data/mockCampaignPlans";
import { daysUntil, discountPct, type ProductForm } from "./campaignsHelpers";

export function CampaignsPage() {
  const toast = useToast();
  const [plans, setPlans] = useLocalStorage<CampaignPlan[]>(
    "compras:campaign-plans",
    CAMPAIGN_PLANS
  );
  const [selId, setSelId] = useState(plans[0]?.id ?? "cyber");
  const [tab, setTab] = useState<"plan" | "perf">("plan");
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
    setPlans((prev) =>
      prev.map((p) => (p.id === camp.id ? { ...p, products: fn([...p.products]) } : p))
    );
  };

  // Posición efectiva de un producto dentro de su placement (orden ascendente,
  // con fallback al orden de aparición en el arreglo).
  const orderOf = (p: CampaignProduct, fallback: number) => p.order ?? fallback + 1;

  // Mueve un producto (por sku+placement) un lugar arriba/abajo dentro de su
  // placement intercambiando su `order` con el vecino. Persiste vía setPlans.
  const moveProduct = (sku: string, placement: PlacementKey, dir: -1 | 1) => {
    updateProducts((arr) => {
      const group = arr
        .map((p, i) => ({ p, i }))
        .filter((x) => x.p.placement === placement)
        .sort((a, b) => orderOf(a.p, a.i) - orderOf(b.p, b.i));
      const pos = group.findIndex((x) => x.p.sku === sku);
      const target = pos + dir;
      if (pos < 0 || target < 0 || target >= group.length) return arr;
      const a = group[pos];
      const b = group[target];
      const oa = orderOf(a.p, a.i);
      const ob = orderOf(b.p, b.i);
      arr[a.i] = { ...a.p, order: ob };
      arr[b.i] = { ...b.p, order: oa };
      return arr;
    });
  };

  // ---- derived ----
  const allocated = camp.products.reduce((a, p) => a + p.budget, 0);
  const estSaleTotal = camp.products.reduce((a, p) => a + p.estSale, 0);
  const avgDiscount = camp.products.length
    ? Math.round(
        camp.products.reduce((a, p) => a + (1 - p.promo / p.normal) * 100, 0) / camp.products.length
      )
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
  // Ordena cada placement por posición de banner (order asc, fallback al orden
  // de inserción en el grupo).
  Object.keys(spaceProducts).forEach((k) => {
    spaceProducts[k] = spaceProducts[k]
      .map((p, i) => ({ p, i }))
      .sort((a, b) => orderOf(a.p, a.i) - orderOf(b.p, b.i))
      .map((x) => x.p);
  });
  const fkOf = (placement: PlacementKey, channel: PromoChannelKey) =>
    placement === "email" ? "email" : channel;

  const allSpaces = SPACE_TYPES.map((s) => {
    const used = spaceUsed[s.placement] ?? 0;
    const avail = Math.max(0, s.total - used);
    const group = spaceProducts[s.placement] ?? [];
    const assigned = group.map((p, i) => ({
      sku: p.sku,
      name: p.name,
      disc: `-${discountPct(p.normal, p.promo)}%`,
      position: i + 1,
      groupTotal: group.length,
      isFirst: i === 0,
      isLast: i === group.length - 1,
    }));
    return {
      ...s,
      filterKey: fkOf(s.placement, s.channel),
      used,
      avail,
      assigned,
      statusLabel:
        avail === 0 ? "Completo" : avail === 1 ? "Último cupo" : `${avail} libres de ${s.total}`,
      statusTone: (avail === 0 ? "red" : avail === 1 ? "amber" : "green") as
        | "red"
        | "amber"
        | "green",
      occPct: Math.round((used / s.total) * 100),
      occBar: avail === 0 ? "#f43f5e" : avail === 1 ? "#f59e0b" : "#10b981",
    };
  });
  const spaces = chFilter === "all" ? allSpaces : allSpaces.filter((s) => s.filterKey === chFilter);

  // Posición de banner por sku (dentro de su placement) para la tabla de productos.
  const positionBySku: Record<
    string,
    { position: number; total: number; isFirst: boolean; isLast: boolean }
  > = {};
  Object.values(spaceProducts).forEach((group) => {
    group.forEach((p, i) => {
      positionBySku[p.sku] = {
        position: i + 1,
        total: group.length,
        isFirst: i === 0,
        isLast: i === group.length - 1,
      };
    });
  });
  const spacesTotal = SPACE_TYPES.reduce((a, s) => a + s.total, 0);
  const spacesUsed = allSpaces.reduce((a, s) => a + s.used, 0);
  const spacesFree = spacesTotal - spacesUsed;
  const freeByKey = (k: string) =>
    allSpaces.filter((s) => k === "all" || s.filterKey === k).reduce((a, s) => a + s.avail, 0);

  const chips = [
    { id: "all", label: "Todos" },
    { id: "web", label: "Web" },
    { id: "tienda", label: "Tienda física" },
    { id: "ml", label: "Mercado Libre" },
    { id: "redes", label: "Redes" },
    { id: "email", label: "Email" },
  ];

  // ---- product form ----
  const retailPrice = (
    sku: string
  ): { normal: number; promo: number; name: string; category: string } | null => {
    const p = products.find((x) => x.sku === sku);
    if (!p) return null;
    const r = Math.round(p.cost / (1 - (p.margin || 30) / 100) / 10) * 10;
    return {
      normal: r,
      promo: Math.round((r * 0.85) / 10) * 10,
      name: p.name,
      category: p.category,
    };
  };

  const openAdd = (preset?: { channel: PromoChannelKey; placement: PlacementKey }) => {
    setForm({
      mode: "add",
      index: -1,
      sku: "",
      name: "",
      category: "",
      from: camp.from,
      to: camp.to,
      normal: "",
      promo: "",
      channel: preset?.channel ?? "redes",
      placement: preset?.placement ?? "reel",
      budget: "",
    });
  };
  const openEdit = (idx: number) => {
    const p = camp.products[idx];
    setForm({
      mode: "edit",
      index: idx,
      sku: p.sku,
      name: p.name,
      category: p.category,
      from: p.from,
      to: p.to,
      normal: String(p.normal),
      promo: String(p.promo),
      channel: p.channel,
      placement: p.placement,
      budget: String(p.budget),
      status: p.status,
      isNew: p.isNew,
    });
  };

  const fNormal = form ? parseInt(form.normal, 10) || 0 : 0;
  const fPromo = form ? parseInt(form.promo, 10) || 0 : 0;
  const fBudget = form ? parseInt(form.budget, 10) || 0 : 0;
  const fDiscount = discountPct(fNormal, fPromo);
  const fValid =
    !!form &&
    !!form.sku &&
    !!form.from &&
    !!form.to &&
    fNormal > 0 &&
    fPromo > 0 &&
    fPromo < fNormal &&
    fBudget > 0 &&
    form.to >= form.from;

  const submitForm = () => {
    if (!form || !fValid) {
      toast.warning("Completa producto, fechas, precios y presupuesto");
      return;
    }
    // Posición del banner: al final de su placement. Si se edita y el placement
    // no cambia, se conserva el orden previo.
    const editing = form.mode === "edit" ? camp.products[form.index] : undefined;
    const samePlacement = editing && editing.placement === form.placement;
    const placementCount = camp.products.filter(
      (x, j) => x.placement === form.placement && (form.mode !== "edit" || j !== form.index)
    ).length;
    const nextOrder = samePlacement ? (editing!.order ?? placementCount + 1) : placementCount + 1;

    const prod: CampaignProduct = {
      name: form.name || form.sku,
      sku: form.sku,
      category: form.category,
      normal: fNormal,
      promo: fPromo,
      from: form.from,
      to: form.to,
      channel: form.channel,
      placement: form.placement,
      placementLabel: PLACEMENT_LABELS[form.placement],
      budget: fBudget,
      estSale: Math.round(fBudget * 4),
      status: form.mode === "edit" ? (form.status ?? "pending") : "pending",
      isNew: form.mode === "edit" ? form.isNew : true,
      order: nextOrder,
    };
    if (form.mode === "edit") {
      const i = form.index;
      updateProducts((arr) => {
        arr[i] = prod;
        return arr;
      });
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
      id,
      name: cmName.trim(),
      from: cmFrom,
      to: cmTo,
      totalBudget: tb,
      channelBudget: {
        redes: Math.round(tb * 0.4),
        ml: Math.round(tb * 0.3),
        web: Math.round(tb * 0.2),
        tienda: Math.round(tb * 0.1),
      },
      products: [],
    };
    setPlans((prev) => [...prev, plan]);
    setSelId(id);
    setCreateOpen(false);
    setCmName("");
    setCmBudget("");
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
        action={
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => openAdd()}>
            Agregar producto
          </Button>
        }
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
              <span
                className={`text-sm font-semibold ${active ? "text-brand-700" : "text-slate-700"}`}
              >
                {p.name}
              </span>
              <span className={`text-xs ${active ? "text-brand-500" : "text-slate-400"}`}>
                {du > 0 ? `en ${du} d` : "en curso"}
              </span>
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
      <CampaignSummaryCard
        camp={camp}
        allocated={allocated}
        estSaleTotal={estSaleTotal}
        avgDiscount={avgDiscount}
        budgetPct={budgetPct}
        overBudget={overBudget}
      />

      {/* tabs: planificación vs rendimiento */}
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(v) => setTab(v as "plan" | "perf")}
        tabs={[
          { value: "plan", label: "Planificación", count: camp.products.length },
          { value: "perf", label: "Rendimiento" },
        ]}
      />

      {tab === "plan" ? (
        <>
          {/* presupuesto por canal */}
          <p className="text-sm font-semibold text-slate-700 mb-2.5">Presupuesto por canal</p>
          <ChannelBudgetGrid camp={camp} channelOrder={channelOrder} />

          {/* espacios publicitarios */}
          <AdSpacesHeader
            spacesFree={spacesFree}
            spacesTotal={spacesTotal}
            spacesUsed={spacesUsed}
            spaceView={spaceView}
            onSpaceViewChange={setSpaceView}
          />

          {/* filtros por canal */}
          <ChannelFilterChips
            chips={chips}
            chFilter={chFilter}
            onChange={setChFilter}
            freeByKey={freeByKey}
          />

          {/* espacios publicitarios: tarjetas o calendario */}
          <AdSpacesView
            spaces={spaces}
            spaceView={spaceView}
            campFrom={camp.from}
            campTo={camp.to}
            moveProduct={moveProduct}
            openAdd={openAdd}
            onInfo={toast.info}
          />

          {/* productos en descuento */}
          <p className="text-sm font-semibold text-slate-700 mb-2.5">Productos en descuento</p>
          <CampaignProductsTable
            products={camp.products}
            positionBySku={positionBySku}
            moveProduct={moveProduct}
            openEdit={openEdit}
            onAdd={() => openAdd()}
          />
        </>
      ) : (
        <CampaignPerformance camp={camp} />
      )}

      {/* Modal agregar/editar producto */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={
          form?.mode === "edit" ? "Editar producto en descuento" : "Agregar producto en descuento"
        }
        description="Define el producto, la vigencia y el precio antes y después."
        size="lg"
        footer={
          <>
            {form?.mode === "edit" && (
              <Button
                variant="danger"
                onClick={() => {
                  const i = form.index;
                  updateProducts((arr) => arr.filter((_, j) => j !== i));
                  setForm(null);
                  toast.success(`Producto quitado de ${camp.name}`);
                }}
              >
                Quitar
              </Button>
            )}
            <span className="flex-1" />
            <Button variant="secondary" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={!fValid}>
              {form?.mode === "edit" ? "Guardar cambios" : "Agregar a la campaña"}
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Producto</label>
              {form.mode === "edit" ? (
                <div className="flex items-center gap-2.5 h-10 border border-slate-200 rounded-lg px-3 bg-slate-50">
                  <span className="text-[11px] font-mono text-slate-400">{form.sku}</span>
                  <span className="text-sm font-medium text-slate-700">{form.name}</span>
                </div>
              ) : (
                <Select
                  value={form.sku}
                  onChange={(e) => {
                    const sku = e.target.value;
                    const r = retailPrice(sku);
                    setForm(
                      (f) =>
                        f && {
                          ...f,
                          sku,
                          name: r?.name ?? "",
                          category: r?.category ?? "",
                          normal: r ? String(r.normal) : f.normal,
                          promo: r ? String(r.promo) : f.promo,
                        }
                    );
                  }}
                  options={[{ value: "", label: "Selecciona un producto…" }, ...productOptions]}
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Descuento desde
                </label>
                <Input
                  type="date"
                  value={form.from}
                  onChange={(e) => setForm((f) => f && { ...f, from: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Descuento hasta
                </label>
                <Input
                  type="date"
                  value={form.to}
                  onChange={(e) => setForm((f) => f && { ...f, to: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-3.5 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Precio antes
                </label>
                <Input
                  inputMode="numeric"
                  value={form.normal}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, normal: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Precio con descuento
                </label>
                <Input
                  inputMode="numeric"
                  value={form.promo}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, promo: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  placeholder="0"
                />
              </div>
              <div className="text-center pb-0.5">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Descuento
                </label>
                <span
                  className={`inline-flex items-center justify-center min-w-[62px] h-10 rounded-lg bg-rose-50 text-base font-bold ${fDiscount > 0 ? "text-rose-600" : "text-slate-300"}`}
                >
                  {fDiscount > 0 ? `-${fDiscount}%` : "—"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Canal</label>
                <Select
                  value={form.channel}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, channel: e.target.value as PromoChannelKey })
                  }
                  options={[
                    { value: "redes", label: "Redes Sociales" },
                    { value: "ml", label: "Mercado Libre" },
                    { value: "web", label: "Web / Banner" },
                    { value: "tienda", label: "Tienda física" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Ubicación / exhibición
                </label>
                <Select
                  value={form.placement}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, placement: e.target.value as PlacementKey })
                  }
                  options={(Object.keys(PLACEMENT_LABELS) as PlacementKey[]).map((k) => ({
                    value: k,
                    label: PLACEMENT_LABELS[k],
                  }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Presupuesto de publicidad
              </label>
              <div className="max-w-[220px]">
                <Input
                  inputMode="numeric"
                  value={form.budget}
                  onChange={(e) =>
                    setForm((f) => f && { ...f, budget: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  placeholder="0"
                />
              </div>
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
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button icon={<IconPlus className="w-4 h-4" />} onClick={submitCreate}>
              Crear campaña
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Nombre de la campaña
            </label>
            <Input
              value={cmName}
              onChange={(e) => setCmName(e.target.value)}
              placeholder="Ej: Cyber Septiembre"
            />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Desde</label>
              <Input type="date" value={cmFrom} onChange={(e) => setCmFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Hasta</label>
              <Input type="date" value={cmTo} onChange={(e) => setCmTo(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Presupuesto total de la campaña
            </label>
            <div className="max-w-[240px]">
              <Input
                inputMode="numeric"
                value={cmBudget}
                onChange={(e) => setCmBudget(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="0"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Se reparte automáticamente: 40% Redes, 30% Mercado Libre, 20% Web, 10% Tienda. Lo
              puedes ajustar después.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
