import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { StatusBadge } from "../components/business/StatusBadge";
import { Badge } from "../components/ui/Badge";
import { BarList } from "../components/business/BarList";
import { InfoHint } from "../components/business/InfoHint";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { categories } from "../data/mockCategories";
import {
  formatCurrency,
  formatCurrencyCompact,
  formatNumber,
  formatPercent,
} from "../utils/formatters";
import type { Category } from "../types/purchasing";

export function CategoriesPage() {
  const navigate = useNavigate();
  const { scope, setScope, inScope, myCategories } = useCategoryScope();

  // Alcance del comprador: por defecto solo sus categorías asignadas.
  const scoped = categories.filter((c) => inScope(c.name));
  const sortedBySales = [...scoped].sort((a, b) => b.salesLast30Days - a.salesLast30Days);
  const sortedByCritical = [...scoped].sort(
    (a, b) => b.stockoutSkus + b.riskSkus - (a.stockoutSkus + a.riskSkus)
  );
  const sortedByMargin = [...scoped].sort((a, b) => a.averageMargin - b.averageMargin);
  const sortedByInventory = [...scoped].sort((a, b) => b.inventoryValue - a.inventoryValue);

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
    {
      key: "actions",
      header: "Acción",
      align: "right",
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link
            to={`/comprar/decisiones?cat=${encodeURIComponent(c.name)}`}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 whitespace-nowrap"
            title={`Ver reposición de ${c.name}`}
          >
            Reposición
          </Link>
          <Link
            to={`/surtido-redundante?cat=${encodeURIComponent(c.name)}`}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            title={`Optimizar surtido de ${c.name}`}
          >
            Surtido
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Categorías"
        description="Salud comercial por categoría: venta, margen, quiebres y rotación."
        action={<ScopeToggle scope={scope} onChange={setScope} myCount={myCategories.length} />}
        help={
          <InfoHint label="Cómo leer esta vista">
            <p>
              Empieza por las tarjetas de la izquierda: muestran las <b>categorías críticas</b>{" "}
              (más quiebres y riesgo).
            </p>
            <p>
              En la columna Quiebre/Riesgo/Sobrestock, los números rojo/ámbar/violeta resumen
              cuántos SKUs requieren acción en cada categoría.
            </p>
            <p>
              Cada fila enlaza directo a su acción: <b>Reposición</b> o <b>Surtido</b>.
            </p>
          </InfoHint>
        }
      />

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
        <CardHeader
          title="Detalle por categoría"
          description={
            scope === "mine" ? "Categorías de tu cartera" : "Todas las categorías del surtido"
          }
        />
        <DataTable
          columns={columns}
          data={scoped}
          rowKey={(c) => c.id}
          onRowClick={(c) => navigate(`/categorias/${c.id}`)}
          emptyMessage={
            scope === "mine"
              ? 'Estás viendo solo tu cartera. Cambia a "Todas" arriba para ver el resto de las categorías.'
              : "No hay categorías."
          }
          mobileCard={(c) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.buyer}</p>
                </div>
                <StatusBadge kind="category" value={c.status} dot={false} />
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {c.stockoutSkus > 0 && <Badge tone="red">{c.stockoutSkus} quiebre</Badge>}
                {c.riskSkus > 0 && <Badge tone="amber">{c.riskSkus} riesgo</Badge>}
                {c.overstockSkus > 0 && <Badge tone="violet">{c.overstockSkus} sobre</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {formatCurrencyCompact(c.salesLast30Days)} venta · compra sug.{" "}
                {formatCurrencyCompact(c.suggestedPurchase)}
              </p>
              <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                <Link
                  to={`/comprar/decisiones?cat=${encodeURIComponent(c.name)}`}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  Reposición
                </Link>
                <Link
                  to={`/surtido-redundante?cat=${encodeURIComponent(c.name)}`}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Surtido
                </Link>
              </div>
            </div>
          )}
        />
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
  items: {
    label: string;
    value: number;
    display: string;
    tone: "red" | "green" | "amber" | "violet";
  }[];
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
