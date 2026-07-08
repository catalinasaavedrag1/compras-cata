import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { productPath } from "../utils/entityLinks";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { DataTable, type Column } from "../components/ui/Table";
import { IconCampaign } from "../components/ui/icons";
import { formatCurrencyCompact, formatNumber, formatPercent } from "../utils/formatters";
import {
  campaignPerformance,
  PERF_CHANNEL_META,
  roasTone,
  type ChannelPerformance,
  type ProductPerformance,
} from "../data/mockCampaignPerformance";
import type { CampaignPlan } from "../data/mockCampaignPlans";
import { Svg } from "./campaignsShared";
import { CHANNEL_BG } from "../utils/tone";

/** Vista de rendimiento (simulado) de una campaña: KPIs + tablas por canal y producto. */
export function CampaignPerformance({ camp }: { camp: CampaignPlan }) {
  const perf = useMemo(() => campaignPerformance(camp), [camp]);

  const channelCols: Column<ChannelPerformance>[] = [
    {
      key: "channel",
      header: "Canal",
      render: (r) => {
        const m = PERF_CHANNEL_META[r.channel];
        return (
          <div className="flex items-center gap-2">
            <span
              className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[m.tone] ?? "bg-slate-100 text-slate-600"}`}
            >
              <Svg path={m.icon} className="w-3.5 h-3.5" />
            </span>
            <span className="text-sm font-semibold text-slate-700">{r.label}</span>
          </div>
        );
      },
    },
    {
      key: "impressions",
      header: "Impresiones",
      align: "right",
      sortable: true,
      sortValue: (r) => r.impressions,
      render: (r) => formatNumber(r.impressions),
    },
    {
      key: "clicks",
      header: "Clics",
      align: "right",
      sortable: true,
      sortValue: (r) => r.clicks,
      render: (r) => formatNumber(r.clicks),
    },
    {
      key: "ctr",
      header: "CTR",
      align: "right",
      sortable: true,
      sortValue: (r) => r.ctr,
      render: (r) => formatPercent(r.ctr),
    },
    {
      key: "conversions",
      header: "Conversiones",
      align: "right",
      sortable: true,
      sortValue: (r) => r.conversions,
      render: (r) => formatNumber(r.conversions),
    },
    {
      key: "revenue",
      header: "Ingresos",
      align: "right",
      sortable: true,
      sortValue: (r) => r.revenue,
      render: (r) => (
        <span className="font-semibold text-emerald-600">{formatCurrencyCompact(r.revenue)}</span>
      ),
    },
    {
      key: "spend",
      header: "Inversión",
      align: "right",
      sortable: true,
      sortValue: (r) => r.spend,
      render: (r) => formatCurrencyCompact(r.spend),
    },
    {
      key: "roas",
      header: "ROAS",
      align: "right",
      sortable: true,
      sortValue: (r) => r.roas,
      render: (r) => (
        <Badge tone={roasTone(r.roas)}>
          {r.roas.toLocaleString("es-CL", { maximumFractionDigits: 1 })}x
        </Badge>
      ),
    },
  ];

  const productCols: Column<ProductPerformance>[] = [
    {
      key: "name",
      header: "Producto",
      render: (r) => (
        <div className="min-w-0">
          <Link
            to={productPath(r.sku)}
            className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
          >
            {r.name}
          </Link>
          <p className="text-[11px] text-slate-400">
            {r.sku} · {r.placementLabel}
          </p>
        </div>
      ),
    },
    {
      key: "channel",
      header: "Canal",
      hideOnMobile: true,
      render: (r) => {
        const m = PERF_CHANNEL_META[r.channel];
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span
              className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${CHANNEL_BG[m.tone] ?? "bg-slate-100 text-slate-600"}`}
            >
              <Svg path={m.icon} className="w-3 h-3" />
            </span>
            {r.channelLabel}
          </span>
        );
      },
    },
    {
      key: "order",
      header: "Posición",
      align: "center",
      sortable: true,
      sortValue: (r) => r.order,
      render: (r) => (
        <Badge tone={r.order === 1 ? "green" : r.order === 2 ? "amber" : "neutral"}>
          {r.order}º
        </Badge>
      ),
    },
    {
      key: "impressions",
      header: "Impresiones",
      align: "right",
      sortable: true,
      sortValue: (r) => r.impressions,
      render: (r) => formatNumber(r.impressions),
    },
    {
      key: "clicks",
      header: "Clics",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.clicks,
      render: (r) => formatNumber(r.clicks),
    },
    {
      key: "ctr",
      header: "CTR",
      align: "right",
      sortable: true,
      sortValue: (r) => r.ctr,
      render: (r) => formatPercent(r.ctr),
    },
    {
      key: "conversions",
      header: "Conversiones",
      align: "right",
      sortable: true,
      sortValue: (r) => r.conversions,
      render: (r) => formatNumber(r.conversions),
    },
    {
      key: "revenue",
      header: "Ingresos",
      align: "right",
      sortable: true,
      sortValue: (r) => r.revenue,
      render: (r) => (
        <span className="font-semibold text-emerald-600">{formatCurrencyCompact(r.revenue)}</span>
      ),
    },
    {
      key: "roas",
      header: "ROAS",
      align: "right",
      sortable: true,
      sortValue: (r) => r.roas,
      render: (r) => (
        <Badge tone={roasTone(r.roas)}>
          {r.roas.toLocaleString("es-CL", { maximumFractionDigits: 1 })}x
        </Badge>
      ),
    },
  ];

  const [chSort, setChSort] = useState<{ key: string | null; dir: "asc" | "desc" }>({
    key: "revenue",
    dir: "desc",
  });
  const [prSort, setPrSort] = useState<{ key: string | null; dir: "asc" | "desc" }>({
    key: "revenue",
    dir: "desc",
  });
  const cycleSort = (
    setter: (
      fn: (s: { key: string | null; dir: "asc" | "desc" }) => {
        key: string | null;
        dir: "asc" | "desc";
      }
    ) => void,
    key: string
  ) =>
    setter((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  return (
    <>
      {/* ===================== RENDIMIENTO (simulado) ===================== */}
      <HelpNote title="Datos simulados (demo)." className="mb-4">
        Las métricas de rendimiento son una simulación para esta demo. En producción se conectarían
        con la analítica de la web, Google Ads y la plataforma de mailing, además de Mercado Libre,
        redes sociales y el punto de venta de la tienda.
      </HelpNote>

      {camp.products.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 inline-flex items-center justify-center mb-3.5">
              <IconCampaign className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              Todavía no hay rendimiento que mostrar
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Agrega productos a la campaña para ver impresiones, clics, conversiones e ingresos.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* KPIs totales */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              title="Inversión"
              value={formatCurrencyCompact(perf.totals.spend)}
              tone="info"
              description="Gasto en publicidad"
            />
            <KpiCard
              title="Ingresos"
              value={formatCurrencyCompact(perf.totals.revenue)}
              tone="good"
              description="Venta atribuida"
            />
            <KpiCard
              title="ROAS"
              value={`${perf.totals.roas.toLocaleString("es-CL", { maximumFractionDigits: 1 })}x`}
              tone={
                roasTone(perf.totals.roas) === "green"
                  ? "good"
                  : roasTone(perf.totals.roas) === "amber"
                    ? "warn"
                    : "bad"
              }
              description="Retorno por $ invertido"
            />
            <KpiCard
              title="Conversiones"
              value={formatNumber(perf.totals.conversions)}
              tone="neutral"
              description="Ventas generadas"
            />
            <KpiCard
              title="CTR promedio"
              value={formatPercent(perf.totals.ctr)}
              tone="neutral"
              description="Clics sobre impresiones"
            />
            <KpiCard
              title="Impresiones"
              value={formatNumber(perf.totals.impressions)}
              tone="neutral"
              description="Veces exhibido"
            />
          </div>

          {/* por canal */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2.5">Rendimiento por canal</p>
            <Card className="overflow-hidden">
              <DataTable
                columns={channelCols}
                data={perf.byChannel}
                rowKey={(r) => r.channel}
                sort={chSort}
                onSortChange={(k) => cycleSort(setChSort, k)}
                emptyMessage="Sin actividad por canal todavía."
              />
            </Card>
          </div>

          {/* por producto */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2.5">Rendimiento por producto</p>
            <Card className="overflow-hidden">
              <DataTable
                columns={productCols}
                data={perf.byProduct}
                rowKey={(r) => r.sku}
                sort={prSort}
                onSortChange={(k) => cycleSort(setPrSort, k)}
                emptyMessage="Sin productos en la campaña."
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
