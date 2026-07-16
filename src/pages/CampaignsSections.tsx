import { Link } from "react-router-dom";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { IconPlus, IconCampaign, IconArrowUp, IconArrowDown } from "../components/ui/icons";
import { Svg } from "./campaignsShared";
import { CHANNEL_BG } from "../utils/tone";
import { productPath, categoryPath } from "../utils/entityLinks";
import { formatCurrency, formatCurrencyCompact } from "../utils/formatters";
import { daysUntil, discountPct, rangeText, STATUS_CFG } from "./campaignsHelpers";
import {
  PROMO_CHANNEL_META,
  PLACEMENT_ICON,
  type CampaignPlan,
  type CampaignProduct,
  type PromoChannelKey,
  type PlacementKey,
  type SpaceType,
} from "../data/mockCampaignPlans";

/** Posición de exhibición de un producto dentro de su placement. */
export interface PositionInfo {
  position: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
}

/** Un producto asignado a un espacio, con su posición de exhibición. */
export interface AdSpaceAssignment {
  sku: string;
  name: string;
  disc: string;
  position: number;
  groupTotal: number;
  isFirst: boolean;
  isLast: boolean;
}

/** Espacio publicitario con su ocupación y asignaciones ya calculadas. */
export interface AdSpace extends SpaceType {
  filterKey: string;
  used: number;
  avail: number;
  assigned: AdSpaceAssignment[];
  statusLabel: string;
  statusTone: "red" | "amber" | "green";
  occPct: number;
  occBar: string;
}

/**
 * Tarjeta de resumen de la campaña seleccionada: nombre, rango, número de
 * productos, descuento promedio, venta estimada y barra de presupuesto asignado.
 * (Extraído de CampaignsPage.)
 */
export function CampaignSummaryCard({
  camp,
  allocated,
  estSaleTotal,
  avgDiscount,
  budgetPct,
  overBudget,
}: {
  camp: CampaignPlan;
  allocated: number;
  estSaleTotal: number;
  avgDiscount: number;
  budgetPct: number;
  overBudget: boolean;
}) {
  return (
    <Card className="mb-4">
      <CardBody className="flex flex-wrap items-center gap-7">
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{camp.name}</span>
            <Badge tone="red">en {daysUntil(camp.from)} días</Badge>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {rangeText(camp.from, camp.to)} {camp.from.slice(0, 4)}
          </p>
        </div>
        <div className="flex gap-6 flex-wrap">
          <div>
            <p className="text-xs text-slate-400">Productos</p>
            <p className="text-lg font-semibold text-slate-800">{camp.products.length}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Descuento prom.</p>
            <p className="text-lg font-semibold text-rose-600">
              {camp.products.length ? `-${avgDiscount}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Venta estimada</p>
            <p className="text-lg font-semibold text-emerald-600">
              {formatCurrencyCompact(estSaleTotal)}
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs text-slate-500">
              Presupuesto asignado <b className="text-slate-700">{formatCurrency(allocated)}</b> de{" "}
              {formatCurrencyCompact(camp.totalBudget)}
            </span>
            <span className="text-xs font-semibold text-slate-600">{budgetPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, budgetPct)}%`,
                background: overBudget ? "#f43f5e" : budgetPct > 90 ? "#f59e0b" : "#10b981",
              }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            {overBudget
              ? `Excede en ${formatCurrency(allocated - camp.totalBudget)}`
              : `Disponible ${formatCurrency(camp.totalBudget - allocated)}`}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Grilla de presupuesto por canal (redes/ML/web/tienda): monto, % del total y
 * barra de uso asignado. (Extraído de CampaignsPage.)
 */
export function ChannelBudgetGrid({
  camp,
  channelOrder,
}: {
  camp: CampaignPlan;
  channelOrder: PromoChannelKey[];
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {channelOrder.map((ch) => {
        const meta = PROMO_CHANNEL_META[ch];
        const budget = camp.channelBudget[ch] || 0;
        const used = camp.products
          .filter((p) => p.channel === ch)
          .reduce((a, p) => a + p.budget, 0);
        const n = camp.products.filter((p) => p.channel === ch).length;
        const usePct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;
        return (
          <Card key={ch}>
            <CardBody>
              <div className="flex items-center gap-2.5 mb-2.5">
                <span
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}
                >
                  <Svg path={meta.icon} className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{meta.label}</p>
                  <p className="text-[11px] text-slate-400">
                    {n} {n === 1 ? "producto" : "productos"}
                  </p>
                </div>
              </div>
              <p className="text-xl font-semibold text-slate-900">
                {formatCurrencyCompact(budget)}
              </p>
              <p className="text-[11px] text-slate-400 mb-2">
                {camp.totalBudget > 0
                  ? `${Math.round((budget / camp.totalBudget) * 100)}% del total`
                  : "—"}
              </p>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${usePct}%`, background: "var(--bar)" }}
                  data-tone={meta.tone}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {formatCurrencyCompact(used)} asignado
              </p>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Cabecera de espacios publicitarios: cupos libres/ocupados, barra de
 * disponibilidad y selector de vista (tarjetas/calendario). (Extraído de CampaignsPage.)
 */
export function AdSpacesHeader({
  spacesFree,
  spacesTotal,
  spacesUsed,
  spaceView,
  onSpaceViewChange,
}: {
  spacesFree: number;
  spacesTotal: number;
  spacesUsed: number;
  spaceView: "grid" | "calendar";
  onSpaceViewChange: (view: "grid" | "calendar") => void;
}) {
  return (
    <Card className="mb-3.5">
      <CardBody className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-3.5">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Svg path="M3 3h18v18H3zM3 9h18M9 21V9" className="w-6 h-6" />
          </span>
          <div>
            <p className="text-xl font-bold text-slate-900">
              {spacesFree} libres{" "}
              <span className="text-sm font-medium text-slate-400">de {spacesTotal} cupos</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              <b className="text-amber-700">{spacesUsed} ocupados</b> · Espacios publicitarios de
              esta campaña
            </p>
          </div>
        </div>
        <div className="flex-1 min-w-[140px] max-w-[280px]">
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.round((spacesFree / spacesTotal) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            {Math.round((spacesFree / spacesTotal) * 100)}% de cupos disponibles
          </p>
        </div>
        <div className="inline-flex bg-slate-100 rounded-lg p-0.5">
          {(["grid", "calendar"] as const).map((v) => (
            <button
              key={v}
              onClick={() => onSpaceViewChange(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${spaceView === v ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"}`}
            >
              {v === "grid" ? "Tarjetas" : "Calendario"}
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Chips de filtro por canal con el conteo de cupos libres por canal.
 * (Extraído de CampaignsPage.)
 */
export function ChannelFilterChips({
  chips,
  chFilter,
  onChange,
  freeByKey,
}: {
  chips: { id: string; label: string }[];
  chFilter: string;
  onChange: (id: string) => void;
  freeByKey: (key: string) => number;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {chips.map((ch) => {
        const active = chFilter === ch.id;
        return (
          <button
            key={ch.id}
            onClick={() => onChange(ch.id)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium border ${active ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600"}`}
          >
            {ch.label}
            <span
              className={`rounded-full px-1.5 text-[11px] ${active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-400"}`}
            >
              {freeByKey(ch.id)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Espacios publicitarios de la campaña en dos vistas: tarjetas (con reorden de
 * banner ▲▼ y asignación) y calendario (fila compacta). (Extraído de CampaignsPage.)
 */
export function AdSpacesView({
  spaces,
  spaceView,
  campFrom,
  campTo,
  moveProduct,
  openAdd,
  onInfo,
}: {
  spaces: AdSpace[];
  spaceView: "grid" | "calendar";
  campFrom: string;
  campTo: string;
  moveProduct: (sku: string, placement: PlacementKey, dir: -1 | 1) => void;
  openAdd: (preset: { channel: PromoChannelKey; placement: PlacementKey }) => void;
  onInfo: (message: string) => void;
}) {
  if (spaceView === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 mb-6">
        {spaces.map((s) => {
          const meta = PROMO_CHANNEL_META[s.channel];
          return (
            <Card key={s.placement}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}
                    >
                      <Svg path={PLACEMENT_ICON[s.placement]} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{s.label}</p>
                      <p className="text-xs text-slate-400">{meta.label}</p>
                    </div>
                  </div>
                  <Badge tone={s.statusTone}>{s.statusLabel}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-900">{s.avail}</span>
                    <span className="text-xs text-slate-400">libres de {s.total}</span>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${s.occPct}%`, background: s.occBar }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {s.used} ocupado{s.used === 1 ? "" : "s"} · {s.avail} libre
                      {s.avail === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Svg
                      path="M12 21s-7-4.4-7-10a7 7 0 0 1 14 0c0 5.6-7 10-7 10z"
                      className="w-3.5 h-3.5 text-slate-400"
                    />{" "}
                    {s.position}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Svg
                      path="M3 3h18v18H3zM3 9h18M9 21V9"
                      className="w-3.5 h-3.5 text-slate-400"
                    />{" "}
                    {s.size}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Svg
                      path="M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18"
                      className="w-3.5 h-3.5 text-slate-400"
                    />{" "}
                    {rangeText(campFrom, campTo)}
                  </span>
                </div>
                {s.assigned.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                      Asignados · orden de exhibición
                    </p>
                    {s.assigned.map((a) => (
                      <div
                        key={a.sku}
                        className="flex items-center gap-2 bg-slate-50 rounded-md px-2 py-1.5"
                      >
                        <Badge
                          tone={
                            a.position === 1 ? "green" : a.position === 2 ? "amber" : "neutral"
                          }
                        >
                          {a.position}º
                        </Badge>
                        <span
                          className="flex-1 min-w-0 text-xs text-slate-700 truncate"
                          title={`${a.name} · Posición ${a.position} de ${a.groupTotal}`}
                        >
                          {a.name}
                        </span>
                        <span className="text-[11px] font-bold text-rose-600">{a.disc}</span>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label={`Subir ${a.name}`}
                            disabled={a.isFirst}
                            onClick={() => moveProduct(a.sku, s.placement, -1)}
                            className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 enabled:hover:border-brand-300 enabled:hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <IconArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Bajar ${a.name}`}
                            disabled={a.isLast}
                            onClick={() => moveProduct(a.sku, s.placement, 1)}
                            className="w-6 h-6 rounded-md border border-slate-200 flex items-center justify-center text-slate-400 enabled:hover:border-brand-300 enabled:hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <IconArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 border border-dashed border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-400">
                    <IconPlus className="w-3.5 h-3.5" /> Sin asignaciones todavía
                  </div>
                )}
                <Button
                  variant={s.avail > 0 ? "primary" : "secondary"}
                  size="sm"
                  className="w-full"
                  icon={s.avail > 0 ? <IconPlus className="w-3.5 h-3.5" /> : undefined}
                  onClick={() =>
                    s.avail > 0
                      ? openAdd({ channel: s.channel, placement: s.placement })
                      : onInfo(`${s.label}: ${s.assigned.map((x) => x.name).join(", ")}`)
                  }
                >
                  {s.avail === 0
                    ? "Ver asignaciones"
                    : s.used === 0
                      ? "Asignar primer producto"
                      : s.avail === 1
                        ? "Asignar último cupo"
                        : "Asignar producto"}
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="mb-6">
      {spaces.map((s) => {
        const meta = PROMO_CHANNEL_META[s.channel];
        return (
          <div
            key={s.placement}
            className="flex items-center gap-3.5 px-4 py-3 border-b border-slate-100 last:border-0"
          >
            <span
              className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}
            >
              <Svg path={PLACEMENT_ICON[s.placement]} className="w-4 h-4" />
            </span>
            <div className="w-40 flex-shrink-0 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{s.label}</p>
              <p className="text-[11px] text-slate-400">{meta.label}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="rounded-md bg-slate-100 overflow-hidden relative"
                style={{ height: 22 }}
              >
                <div
                  className="h-full"
                  style={{ width: `${s.occPct}%`, background: s.occBar, opacity: 0.22 }}
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-600">
                  {s.used} ocupado{s.used === 1 ? "" : "s"} · {s.avail} libre
                  {s.avail === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <Badge tone={s.statusTone}>{s.statusLabel}</Badge>
            <button
              onClick={() =>
                s.avail > 0 ? openAdd({ channel: s.channel, placement: s.placement }) : undefined
              }
              className="text-xs font-semibold text-brand-600 whitespace-nowrap"
            >
              {s.avail === 0 ? "Completo" : "Asignar"}
            </button>
          </div>
        );
      })}
    </Card>
  );
}

/**
 * Tabla de productos en descuento de la campaña (o estado vacío): precio
 * antes/después, vigencia, canal, posición con reorden ▲▼, presupuesto, venta
 * estimada, estado y edición por fila. (Extraído de CampaignsPage.)
 */
export function CampaignProductsTable({
  products,
  positionBySku,
  moveProduct,
  openEdit,
  onAdd,
}: {
  products: CampaignProduct[];
  positionBySku: Record<string, PositionInfo>;
  moveProduct: (sku: string, placement: PlacementKey, dir: -1 | 1) => void;
  openEdit: (idx: number) => void;
  onAdd: () => void;
}) {
  if (products.length === 0) {
    return (
      <Card>
        <CardBody className="py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 inline-flex items-center justify-center mb-3.5">
            <IconCampaign className="w-6 h-6" />
          </div>
          <p className="text-base font-semibold text-slate-800">
            Aún no hay productos en esta campaña
          </p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Agrega los productos que estarán en descuento, con su vigencia y precio.
          </p>
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={onAdd}>
            Agregar producto
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[920px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              {[
                "Producto",
                "Precio antes / después",
                "Vigencia",
                "Canal y ubicación",
                "Posición",
                "Presupuesto",
                "Venta estim.",
                "Estado",
                "",
              ].map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 ${i >= 5 && i <= 6 ? "text-right" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => {
              const meta = PROMO_CHANNEL_META[p.channel];
              const st = STATUS_CFG[p.status];
              const disc = discountPct(p.normal, p.promo);
              const pos = positionBySku[p.sku];
              return (
                <tr key={`${p.sku}-${idx}`} className="border-b border-slate-100">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={productPath(p.sku)}
                        className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.isNew && (
                        <span className="rounded-full px-1.5 py-px text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">
                          Nuevo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {p.sku} ·{" "}
                      <Link
                        to={categoryPath(p.category)}
                        className="hover:text-brand-700 hover:underline"
                      >
                        {p.category}
                      </Link>
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[11px] text-slate-400 line-through">
                        {formatCurrency(p.normal)}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(p.promo)}
                      </span>
                    </div>
                    <span className="inline-flex rounded-full px-1.5 py-px text-[11px] font-bold bg-rose-50 text-rose-600 mt-0.5">
                      -{disc}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">{rangeText(p.from, p.to)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[meta.tone]}`}
                      >
                        <Svg path={meta.icon} className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700">{meta.label}</p>
                        <p className="text-[11px] text-slate-400">{p.placementLabel}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {pos ? (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          tone={
                            pos.position === 1 ? "green" : pos.position === 2 ? "amber" : "neutral"
                          }
                        >
                          {pos.position}º
                        </Badge>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            aria-label="Subir"
                            disabled={pos.isFirst}
                            onClick={() => moveProduct(p.sku, p.placement, -1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 enabled:hover:border-brand-300 enabled:hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <IconArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Bajar"
                            disabled={pos.isLast}
                            onClick={() => moveProduct(p.sku, p.placement, 1)}
                            className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 enabled:hover:border-brand-300 enabled:hover:text-brand-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <IconArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          de {pos.total}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-slate-700">
                    {formatCurrency(p.budget)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-emerald-600">
                    {formatCurrencyCompact(p.estSale)}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => openEdit(idx)}
                      title="Editar"
                      className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:border-brand-300 hover:text-brand-600"
                    >
                      <Svg
                        path="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"
                        className="w-4 h-4"
                      />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
