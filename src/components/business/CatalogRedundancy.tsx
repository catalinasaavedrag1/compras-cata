import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  Product,
  CampaignProductLine,
  CreatedCampaign,
  PromoChannel,
} from "../../types/purchasing";
import {
  analyzeCatalog,
  ACTION_LABEL,
  TIER_LABEL,
  type RedundancyAction,
  type RedundantCandidate,
} from "../../utils/catalogOptimization";
import { Card, CardBody } from "../ui/Card";
import { Badge, type BadgeTone } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { KpiCard } from "./KpiCard";
import { HelpNote } from "./HelpNote";
import { ExportButton } from "./ExportButton";
import { CampaignBuilderModal } from "./CampaignBuilderModal";
import { useLocalStorage } from "../../utils/useLocalStorage";
import { useToast } from "../../context/ToastContext";
import { cn } from "../../utils/cn";
import type { CsvColumn } from "../../utils/exportCsv";
import { formatCurrencyCompact, formatNumber, formatPercent } from "../../utils/formatters";
import { IconCategories, IconProducts, IconInventory, IconCheck, IconCampaign } from "../ui/icons";

interface CatalogRedundancyProps {
  /** Productos del ámbito (una categoría o todo el catálogo). */
  products: Product[];
  /** Muestra la fila de KPIs resumen (true por defecto). */
  showSummary?: boolean;
  /** Etiqueta del ámbito para nombrar la campaña de liquidación (ej. categoría). */
  scopeLabel?: string;
}

const actionTone: Record<RedundancyAction, BadgeTone> = {
  liquidate: "amber",
  discontinue: "red",
  review: "slate",
};

/** Descuento sugerido por defecto para una campaña de liquidación. */
const LIQUIDATION_DISCOUNT = 30;

/** Fila plana para exportar a CSV (candidato + contexto de su grupo). */
interface ExportRow {
  candidate: RedundantCandidate;
  category: string;
  subcategory: string;
}

const exportColumns: CsvColumn<ExportRow>[] = [
  { label: "SKU", value: (r) => r.candidate.product.sku },
  { label: "Producto", value: (r) => r.candidate.product.name },
  { label: "Categoría", value: (r) => r.category },
  { label: "Subcategoría", value: (r) => r.subcategory },
  { label: "Acción sugerida", value: (r) => ACTION_LABEL[r.candidate.action] },
  { label: "Conservar (líder)", value: (r) => r.candidate.leaderName },
  { label: "Venta 30d", value: (r) => r.candidate.product.salesLast30Days },
  { label: "Stock disponible", value: (r) => r.candidate.product.availableStock },
  { label: "Días inventario", value: (r) => r.candidate.product.inventoryDays },
  { label: "Capital inmovilizado", value: (r) => r.candidate.tiedCapital },
];

type RedundancyFilter = "all" | RedundancyAction | "reactivate";

/** Un tipo de producto (subcategoría) con exceso de variedad. */
function GroupCard({
  group,
  filter,
}: {
  group: ReturnType<typeof analyzeCatalog>["groups"][number];
  filter: RedundancyFilter;
}) {
  const keepers = filter === "reactivate" ? group.keepers.filter((k) => k.reactivate) : group.keepers;
  const candidates =
    filter === "all"
      ? group.candidates
      : filter === "reactivate"
        ? []
        : group.candidates.filter((c) => c.action === filter);

  return (
    <Card>
      <CardBody className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{group.subcategory}</p>
            <p className="text-xs text-slate-500">
              {group.category} · {group.members.length} SKUs · bastan {group.keepers.length}
            </p>
          </div>
          <span className="flex-shrink-0 text-right">
            <span className="block text-xs text-slate-500">Capital liberable</span>
            <span className="block text-sm font-semibold text-rose-600">
              {formatCurrencyCompact(group.freeableCapital)}
            </span>
          </span>
        </div>

        {/* Surtido sugerido: uno por gama */}
        {keepers.length > 0 && (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Conservar (uno por gama)</p>
            {keepers.map((k) => (
              <Link
                key={k.product.sku}
                to={`/productos/${k.product.sku}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2 hover:border-emerald-300"
              >
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-500">{k.product.sku}</span>
                  <p className="text-sm font-medium text-slate-800 truncate">{k.product.name}</p>
                  <p className="text-xs text-slate-500">
                    gama {TIER_LABEL[k.segment]} · vende {formatNumber(k.product.salesLast30Days)}/mes · rota {formatNumber(k.product.rotation)}× · margen {formatPercent(k.product.margin, 0)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge tone="green" dot>
                    Conservar
                  </Badge>
                  {k.reactivate && <Badge tone="amber">Reactivar compra</Badge>}
                </div>
              </Link>
            ))}
          </>
        )}

        {/* Redundantes: sobran en su gama */}
        {candidates.length > 0 && (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 pt-0.5">Sobran</p>
            {candidates.map((c) => (
              <Link
                key={c.product.sku}
                to={`/productos/${c.product.sku}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-500">{c.product.sku}</span>
                  <p className="text-sm font-medium text-slate-800 truncate">{c.product.name}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{c.reason}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <Badge tone={actionTone[c.action]}>{ACTION_LABEL[c.action]}</Badge>
                  <span className="text-xs text-slate-500">{formatCurrencyCompact(c.tiedCapital)}</span>
                </div>
              </Link>
            ))}
          </>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Vista de catálogo optimizado: SKUs redundantes por subcategoría, con el SKU
 * a conservar, el motivo, la acción sugerida y el capital liberable. Permite
 * exportar la lista y lanzar una campaña de liquidación con los SKUs con stock.
 * Reutilizable en la página global y en la pestaña del detalle de categoría.
 */
export function CatalogRedundancy({ products, showSummary = true, scopeLabel }: CatalogRedundancyProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [, setCampaigns] = useLocalStorage<CreatedCampaign[]>("compras:campaigns", []);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [filter, setFilter] = useState<RedundancyFilter>("all");

  const analysis = analyzeCatalog(products);

  if (analysis.candidateCount === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            title="Catálogo sano"
            description="No se detectaron SKUs redundantes en este ámbito. Cada subcategoría tiene un surtido diferenciado."
          />
        </CardBody>
      </Card>
    );
  }

  const allCandidates = analysis.groups.flatMap((g) => g.candidates);
  const liquidateCount = allCandidates.filter((c) => c.action === "liquidate").length;
  const discontinueCount = allCandidates.filter((c) => c.action === "discontinue").length;

  const allFilterOptions: { key: RedundancyFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: analysis.candidateCount },
    { key: "liquidate", label: "Liquidar", count: liquidateCount },
    { key: "discontinue", label: "Descontinuar", count: discontinueCount },
    { key: "reactivate", label: "Reactivar compra", count: analysis.reactivateCount },
  ];
  const filterOptions = allFilterOptions.filter((o) => o.key === "all" || o.count > 0);

  const visibleGroups = analysis.groups.filter((g) => {
    if (filter === "all") return true;
    if (filter === "reactivate") return g.keepers.some((k) => k.reactivate);
    return g.candidates.some((c) => c.action === filter);
  });

  const exportRows: ExportRow[] = analysis.groups.flatMap((g) =>
    g.candidates.map((candidate) => ({ candidate, category: g.category, subcategory: g.subcategory }))
  );

  // Líneas para la campaña de liquidación: redundantes con stock disponible.
  const liquidationLines: CampaignProductLine[] = allCandidates
    .filter((c) => c.product.availableStock > 0)
    .map((c) => ({
      sku: c.product.sku,
      productName: c.product.name,
      basePrice: c.product.price,
      discountPct: LIQUIDATION_DISCOUNT,
      campaignPrice: Math.round(c.product.price * (1 - LIQUIDATION_DISCOUNT / 100)),
      availableStock: c.product.availableStock,
    }));

  const handleCampaignSave = (campaign: CreatedCampaign) => {
    setCampaigns((prev) => [campaign, ...prev]);
    setCampaignOpen(false);
    toast.success(`Campaña “${campaign.name}” creada con ${campaign.products.length} producto(s)`, {
      label: "Ver campañas",
      onClick: () => navigate("/campanas-oportunidades"),
    });
  };

  return (
    <div className="space-y-4">
      {showSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            title="Subcategorías saturadas"
            value={formatNumber(analysis.saturatedSubcategories)}
            tone="warn"
            icon={<IconCategories className="w-4 h-4" />}
            description="con SKUs que se solapan"
          />
          <KpiCard
            title="SKUs redundantes"
            value={formatNumber(analysis.candidateCount)}
            tone="bad"
            icon={<IconProducts className="w-4 h-4" />}
            description={`${formatPercent(analysis.redundantShare * 100, 0)} del surtido`}
          />
          <KpiCard
            title="Capital liberable"
            value={formatCurrencyCompact(analysis.freeableCapital)}
            tone="info"
            icon={<IconInventory className="w-4 h-4" />}
            description="inmovilizado en redundantes"
          />
          <KpiCard
            title="SKUs analizados"
            value={formatNumber(analysis.totalSkus)}
            tone="neutral"
            icon={<IconCheck className="w-4 h-4" />}
            description="en el ámbito"
          />
        </div>
      )}

      <HelpNote variant="tip" title="Cómo leerlo:">
        Basta una opción por <strong>gama</strong> (económica, media, premium): se conserva la mejor de
        cada una; las demás <strong>sobran</strong>.
      </HelpNote>

      {/* Filtros por acción + acciones (exportar / campaña de liquidación). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {filterOptions.map((o) => (
            <button
              key={o.key}
              onClick={() => setFilter(o.key)}
              className={cn(
                "whitespace-nowrap flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
                filter === o.key
                  ? "border-brand-300 bg-brand-50 text-brand-700"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {o.label} ({formatNumber(o.count)})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename="catalogo-redundantes" rows={exportRows} columns={exportColumns} />
          {liquidationLines.length > 0 && (
            <Button
              size="sm"
              icon={<IconCampaign className="w-4 h-4" />}
              onClick={() => setCampaignOpen(true)}
            >
              Crear campaña de liquidación ({liquidationLines.length})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {visibleGroups.map((g) => (
          <GroupCard key={`${g.category}-${g.subcategory}`} group={g} filter={filter} />
        ))}
      </div>

      <CampaignBuilderModal
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        onSave={handleCampaignSave}
        initialName={scopeLabel ? `Liquidación ${scopeLabel}` : "Liquidación de surtido"}
        initialLines={liquidationLines}
        initialChannels={["web", "marketplace"] as PromoChannel[]}
      />
    </div>
  );
}
