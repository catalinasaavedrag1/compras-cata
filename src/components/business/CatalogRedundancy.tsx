import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { ProductCatalogRow } from "../../hooks/useProductsCatalog";
import { Card, CardBody } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { KpiCard } from "./KpiCard";
import { HelpNote } from "./HelpNote";
import { ExportButton } from "./ExportButton";
import { productPath } from "../../utils/entityLinks";
import type { CsvColumn } from "../../utils/exportCsv";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../../utils/formatters";
import { IconCategories, IconProducts, IconInventory, IconCheck } from "../ui/icons";

// ============================================================================
//  Surtido redundante — sobre filas reales del motor (ProductCatalogRow).
//  ---------------------------------------------------------------------------
//  La redundancia fina "una opción por gama de precio dentro de un tipo de
//  producto" exige subcategoría y precio de venta, que el motor NO entrega. Con
//  los datos reales (categoría, stock, costo, venta en unidades) el proxy
//  honesto es: SKUs SIN ROTACIÓN (0 ventas 30d) con stock disponible, agrupados
//  por categoría — capital inmovilizado que conviene racionalizar. El capital se
//  muestra A COSTO (stock × costo). No se arma campaña de liquidación porque no
//  hay precio de venta para calcular el precio con descuento.
// ============================================================================

interface CatalogRedundancyProps {
  rows: ProductCatalogRow[];
  /** Muestra la fila de KPIs resumen (true por defecto). */
  showSummary?: boolean;
}

interface RedundantCandidate {
  row: ProductCatalogRow;
  tiedCapital: number | null;
}

interface RedundancyGroup {
  category: string;
  categoryId: string | null;
  candidates: RedundantCandidate[];
  freeableCapital: number;
}

/** Capital a costo (stock × costo). null si falta stock o costo. */
function tiedCapitalOf(p: ProductCatalogRow): number | null {
  if (p.stockAvailable === null || p.unitCost === null) return null;
  return p.stockAvailable * p.unitCost;
}

const exportColumns: CsvColumn<RedundantCandidate>[] = [
  { label: "SKU", value: (r) => r.row.sku },
  { label: "Producto", value: (r) => r.row.name },
  { label: "Categoría", value: (r) => r.row.categoryName ?? "" },
  { label: "Proveedor", value: (r) => r.row.supplierName ?? "" },
  { label: "Venta 30d (u.)", value: (r) => r.row.sales30Units ?? "" },
  { label: "Stock disponible", value: (r) => r.row.stockAvailable ?? "" },
  { label: "Capital a costo", value: (r) => r.tiedCapital ?? "" },
];

export function CatalogRedundancy({ rows, showSummary = true }: CatalogRedundancyProps) {
  const groups = useMemo<RedundancyGroup[]>(() => {
    const byCat = new Map<string, RedundancyGroup>();
    for (const p of rows) {
      if (!(p.sales30Units === 0 && (p.stockAvailable ?? 0) > 0)) continue;
      const category = p.categoryName ?? "Sin categoría";
      const g =
        byCat.get(category) ??
        { category, categoryId: p.categoryId, candidates: [], freeableCapital: 0 };
      const tiedCapital = tiedCapitalOf(p);
      g.candidates.push({ row: p, tiedCapital });
      g.freeableCapital += tiedCapital ?? 0;
      byCat.set(category, g);
    }
    return Array.from(byCat.values())
      .map((g) => ({
        ...g,
        candidates: [...g.candidates].sort(
          (a, b) => (b.tiedCapital ?? 0) - (a.tiedCapital ?? 0)
        ),
      }))
      .sort((a, b) => b.freeableCapital - a.freeableCapital);
  }, [rows]);

  const allCandidates = useMemo(() => groups.flatMap((g) => g.candidates), [groups]);
  const candidateCount = allCandidates.length;

  if (candidateCount === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            title="Sin SKUs redundantes"
            description="No hay SKUs sin rotación con stock en este ámbito: el surtido está trabajando. La redundancia fina por gama de precio requiere subcategoría y precio de venta (no disponibles)."
          />
        </CardBody>
      </Card>
    );
  }

  const saturatedCategories = groups.filter((g) => g.candidates.length >= 2).length;
  const freeableCapital = groups.reduce((s, g) => s + g.freeableCapital, 0);
  const redundantShare = rows.length > 0 ? candidateCount / rows.length : 0;

  return (
    <div className="space-y-4">
      {showSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            title="Categorías con solapamiento"
            value={formatNumber(saturatedCategories)}
            tone="warn"
            icon={<IconCategories className="w-4 h-4" />}
            description="≥ 2 SKUs sin rotación"
          />
          <KpiCard
            title="SKUs redundantes"
            value={formatNumber(candidateCount)}
            tone="bad"
            icon={<IconProducts className="w-4 h-4" />}
            description={`${Math.round(redundantShare * 100)}% del surtido`}
          />
          <KpiCard
            title="Capital liberable (costo)"
            value={formatCurrencyCompact(freeableCapital)}
            tone="info"
            icon={<IconInventory className="w-4 h-4" />}
            description="inmovilizado en redundantes"
          />
          <KpiCard
            title="SKUs analizados"
            value={formatNumber(rows.length)}
            tone="neutral"
            icon={<IconCheck className="w-4 h-4" />}
            description="en el ámbito"
          />
        </div>
      )}

      <HelpNote variant="tip" title="Qué es “redundante” aquí:">
        Con los datos del motor no se puede afinar por <strong>gama de precio</strong> dentro de un
        tipo de producto (falta subcategoría y precio de venta). El proxy honesto son los SKUs{" "}
        <strong>sin rotación</strong> (0 ventas en 30 días) con <strong>stock disponible</strong>,
        agrupados por categoría: capital <strong>a costo</strong> que conviene liquidar o
        descontinuar.
      </HelpNote>

      <div className="flex items-center justify-end">
        <ExportButton
          filename="catalogo-redundantes"
          rows={allCandidates}
          columns={exportColumns}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {groups.map((g) => (
          <Card key={g.category}>
            <CardBody className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{g.category}</p>
                  <p className="text-xs text-slate-500">
                    {g.candidates.length} SKU sin rotación con stock
                  </p>
                </div>
                <span className="flex-shrink-0 text-right">
                  <span className="block text-xs text-slate-400">Capital liberable</span>
                  <span className="block text-sm font-semibold text-rose-600">
                    {formatCurrencyCompact(g.freeableCapital)}
                  </span>
                </span>
              </div>

              {g.candidates.map((c) => (
                <Link
                  key={c.row.sku}
                  to={productPath(c.row.sku)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-slate-400">{c.row.sku}</span>
                    <p className="text-sm font-medium text-slate-800 truncate">{c.row.name}</p>
                    <p className="text-xs text-slate-500">
                      0 ventas 30d · stock{" "}
                      {c.row.stockAvailable === null ? "—" : formatNumber(c.row.stockAvailable)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge tone="amber">Liquidar / descontinuar</Badge>
                    <span className="text-xs text-slate-500">
                      {c.tiedCapital === null ? "—" : formatCurrency(c.tiedCapital)}
                    </span>
                  </div>
                </Link>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
