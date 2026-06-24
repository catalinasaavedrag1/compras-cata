import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { StatusBadge } from "../components/business/StatusBadge";
import { Badge } from "../components/ui/Badge";
import { BarList } from "../components/business/BarList";
import { HelpNote } from "../components/business/HelpNote";
import { categories } from "../data/mockCategories";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import type { Category } from "../types/purchasing";

export function CategoriesPage() {
  const sortedBySales = [...categories].sort((a, b) => b.salesLast30Days - a.salesLast30Days);
  const sortedByCritical = [...categories].sort(
    (a, b) => b.stockoutSkus + b.riskSkus - (a.stockoutSkus + a.riskSkus)
  );
  const sortedByMargin = [...categories].sort((a, b) => a.averageMargin - b.averageMargin);
  const sortedByInventory = [...categories].sort((a, b) => b.inventoryValue - a.inventoryValue);

  const columns: Column<Category>[] = [
    {
      key: "name",
      header: "Categoría",
      render: (c) => (
        <div>
          <p className="font-medium text-slate-800">{c.name}</p>
          <p className="text-xs text-slate-500">{c.buyer}</p>
        </div>
      ),
    },
    { key: "skus", header: "SKUs", align: "right", render: (c) => formatNumber(c.activeSkus) },
    {
      key: "sales",
      header: "Venta 30 / 90 días",
      align: "right",
      hideOnMobile: true,
      render: (c) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatCurrencyCompact(c.salesLast30Days)}</p>
          <p className="text-xs text-slate-400">{formatCurrencyCompact(c.salesLast90Days)}</p>
        </div>
      ),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      render: (c) => (
        <span className={c.averageMargin < 28 ? "text-amber-600 font-medium" : "text-slate-700"}>
          {formatPercent(c.averageMargin)}
        </span>
      ),
    },
    {
      key: "inventory",
      header: "Inventario",
      align: "right",
      hideOnMobile: true,
      render: (c) => formatCurrencyCompact(c.inventoryValue),
    },
    {
      key: "health",
      header: "Quiebre / Riesgo / Sobre",
      align: "center",
      hideOnMobile: true,
      render: (c) => (
        <div className="flex items-center justify-center gap-1.5">
          <Badge tone="red">{c.stockoutSkus}</Badge>
          <Badge tone="amber">{c.riskSkus}</Badge>
          <Badge tone="violet">{c.overstockSkus}</Badge>
        </div>
      ),
    },
    {
      key: "rotation",
      header: "Rotación",
      align: "right",
      hideOnMobile: true,
      render: (c) => `${c.averageRotation.toLocaleString("es-CL")}x`,
    },
    {
      key: "purchase",
      header: "Compra sugerida",
      align: "right",
      render: (c) => (
        <span className="font-medium text-slate-800">{formatCurrency(c.suggestedPurchase)}</span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (c) => <StatusBadge kind="category" value={c.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Salud comercial por categoría: venta, margen, inventario, quiebres y rotación. Identifica dónde concentrar la gestión de compra."
      />

      <HelpNote className="mb-4">
        Empieza por las tarjetas de la izquierda: muestran las <b>categorías críticas</b> (más quiebres
        y riesgo). En la columna Quiebre/Riesgo/Sobrestock, los números rojo/ámbar/violeta resumen cuántos
        SKUs requieren acción en cada categoría.
      </HelpNote>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <RankCard
          title="Categorías críticas"
          subtitle="Más quiebres + riesgo"
          items={sortedByCritical.slice(0, 5).map((c) => ({
            label: c.name,
            value: c.stockoutSkus + c.riskSkus,
            display: `${c.stockoutSkus + c.riskSkus} SKUs`,
            tone: "red" as const,
          }))}
        />
        <RankCard
          title="Mayor venta (30d)"
          subtitle="Categorías top"
          items={sortedBySales.slice(0, 5).map((c) => ({
            label: c.name,
            value: c.salesLast30Days,
            display: formatCurrencyCompact(c.salesLast30Days),
            tone: "green" as const,
          }))}
        />
        <RankCard
          title="Peor margen"
          subtitle="Margen promedio más bajo"
          items={sortedByMargin.slice(0, 5).map((c) => ({
            label: c.name,
            value: 100 - c.averageMargin,
            display: formatPercent(c.averageMargin),
            tone: "amber" as const,
          }))}
        />
        <RankCard
          title="Mayor inventario inmovilizado"
          subtitle="Inventario valorizado"
          items={sortedByInventory.slice(0, 5).map((c) => ({
            label: c.name,
            value: c.inventoryValue,
            display: formatCurrencyCompact(c.inventoryValue),
            tone: "violet" as const,
          }))}
        />
      </div>

      <Card>
        <CardHeader title="Detalle por categoría" description="Todas las categorías del surtido" />
        <DataTable columns={columns} data={categories} rowKey={(c) => c.id} />
      </Card>
    </div>
  );
}

function RankCard({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: { label: string; value: number; display: string; tone: "red" | "green" | "amber" | "violet" }[];
}) {
  return (
    <Card>
      <CardHeader title={title} description={subtitle} />
      <CardBody>
        <BarList items={items} />
      </CardBody>
    </Card>
  );
}
