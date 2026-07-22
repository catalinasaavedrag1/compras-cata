import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { BarList } from "../components/business/BarList";
import { InfoHint } from "../components/business/InfoHint";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { useCategoriesPanel } from "../hooks/useCategoriesPanel";
import { usePurchaseContext } from "../hooks/usePurchaseContext";
import { categoryPath } from "../utils/entityLinks";
import { formatCurrency, formatCurrencyCompact, formatNumber, formatPercent } from "../utils/formatters";
import type { CategoryPanelRow } from "../services/purchaseBff";

// ============================================================================
//  Categorías conectadas al purchase-bff (GET /categories, flujo 12): motor de
//  reposición + presupuesto (OTB) + cartera por categoría.
//  - "Mi cartera" compara el buyerId real de la fila con el del contexto de
//    sesión (GET /context); sin buyerId en sesión se muestran todas.
//  - Columnas mock sin fuente real (venta CLP, inventario, rotación, estado,
//    sobrestock) se eliminaron; venta va en UNIDADES y null = dato degradado.
// ============================================================================

/** Umbral de margen promedio bajo (%) para resaltar la celda. */
const LOW_AVG_MARGIN_PCT = 28;

export function CategoriesPage() {
  const navigate = useNavigate();
  const { scope, setScope, scoped } = useCategoryScope();
  const { context } = usePurchaseContext();
  const { rows, warnings, loading, error, configured, refetch } = useCategoriesPanel();

  // Alcance del comprador: filas cuyo buyerId coincide con el de la sesión.
  const buyerId = context?.buyerId ?? null;
  const myRows = buyerId ? rows.filter((c) => c.buyerId === buyerId) : rows;
  const visible = scoped ? myRows : rows;

  const criticalCount = (c: CategoryPanelRow) =>
    c.byPriority.stockout_imminent + c.byPriority.low_stock;
  const sortedByCritical = [...visible].sort((a, b) => criticalCount(b) - criticalCount(a));
  const sortedByMargin = visible
    .filter((c) => c.avgMarginPct !== null)
    .sort((a, b) => a.avgMarginPct! - b.avgMarginPct!);
  const sortedBySuggested = [...visible].sort(
    (a, b) => b.suggestedAmountClp - a.suggestedAmountClp
  );

  const pageTitle = "Categorías";
  const pageDescription =
    "Salud comercial por categoría: SKUs conocidos, venta, margen, quiebres y compra sugerida.";

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
              ver el panel real de categorías del servicio de compras.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando categorías">
            {Array.from({ length: 6 }).map((_, i) => (
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

  if (error && rows.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar las categorías
            </p>
            <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            <Button className="mt-4" onClick={refetch}>
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const columns: Column<CategoryPanelRow>[] = [
    {
      key: "name",
      header: "Categoría",
      render: (c) => (
        <div>
          <p className="font-medium text-slate-800">{c.name}</p>
          <p className="text-xs text-slate-500">{c.buyerId ?? "Sin asignar"}</p>
        </div>
      ),
    },
    {
      key: "skus",
      header: "SKUs conocidos",
      align: "right",
      render: (c) => formatNumber(c.skuCount),
    },
    {
      key: "sales",
      header: "Venta 30 días (unid.)",
      align: "right",
      hideOnMobile: true,
      render: (c) =>
        c.sales30Units === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          formatNumber(c.sales30Units)
        ),
    },
    {
      key: "margin",
      header: "Margen prom.",
      align: "right",
      render: (c) =>
        c.avgMarginPct === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          <span
            className={
              c.avgMarginPct < LOW_AVG_MARGIN_PCT ? "text-amber-600 font-medium" : "text-slate-700"
            }
          >
            {formatPercent(c.avgMarginPct)}
          </span>
        ),
    },
    {
      key: "health",
      header: "Quiebre / Riesgo",
      align: "center",
      hideOnMobile: true,
      render: (c) => (
        <div className="flex items-center justify-center gap-1.5">
          <Badge tone="red">{c.byPriority.stockout_imminent}</Badge>
          <Badge tone="amber">{c.byPriority.low_stock}</Badge>
        </div>
      ),
    },
    {
      key: "purchase",
      header: "Compra sugerida",
      align: "right",
      render: (c) => (
        <div className="text-sm">
          <p className="font-medium text-slate-800">{formatCurrency(c.suggestedAmountClp)}</p>
          <p className="text-xs text-slate-400">
            {c.pendingCount} pendiente{c.pendingCount === 1 ? "" : "s"}
          </p>
        </div>
      ),
    },
    {
      key: "budget",
      header: "Presupuesto disp.",
      align: "right",
      hideOnMobile: true,
      render: (c) =>
        c.budget === null ? (
          <span className="text-slate-300">—</span>
        ) : (
          formatCurrencyCompact(c.budget.availableClp)
        ),
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
        title={pageTitle}
        description={pageDescription}
        action={
          <ScopeToggle
            scope={scope}
            onChange={setScope}
            myCount={buyerId ? myRows.length : undefined}
          />
        }
        help={
          <InfoHint label="Cómo leer esta vista">
            <p>
              Empieza por las tarjetas de la izquierda: muestran las <b>categorías críticas</b>{" "}
              (más quiebres y riesgo según el motor).
            </p>
            <p>
              En la columna Quiebre/Riesgo, los números rojo/ámbar resumen cuántos SKUs requieren
              acción en cada categoría.
            </p>
            <p>
              Cada fila enlaza directo a su acción: <b>Reposición</b> o <b>Surtido</b>.
            </p>
          </InfoHint>
        }
      />

      {warnings.length > 0 && (
        <Card className="mb-3 border-amber-200 bg-amber-50/60">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-xs text-amber-800">
            <Badge tone="amber">Datos parciales</Badge>
            {warnings.map((w) => (
              <span key={w.code}>{w.message}</span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <RankCard
          title="Categorías críticas"
          subtitle="Más quiebres + riesgo"
          items={sortedByCritical.slice(0, 5).map((c) => ({
            label: c.name,
            value: criticalCount(c),
            display: `${criticalCount(c)} SKUs`,
            tone: "red" as const,
          }))}
        />
        <RankCard
          title="Peor margen"
          subtitle="Margen promedio más bajo"
          items={sortedByMargin.slice(0, 5).map((c) => ({
            label: c.name,
            value: 100 - c.avgMarginPct!,
            display: formatPercent(c.avgMarginPct!),
            tone: "amber" as const,
          }))}
        />
        <RankCard
          title="Mayor compra sugerida"
          subtitle="Capital que pide el motor"
          items={sortedBySuggested.slice(0, 5).map((c) => ({
            label: c.name,
            value: c.suggestedAmountClp,
            display: formatCurrencyCompact(c.suggestedAmountClp),
            tone: "green" as const,
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
          data={visible}
          rowKey={(c) => c.categoryId}
          onRowClick={(c) => navigate(categoryPath(c.categoryId))}
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
                  <p className="text-xs text-slate-500">{c.buyerId ?? "Sin asignar"}</p>
                </div>
                <span className="text-xs text-slate-400">{formatNumber(c.skuCount)} SKUs</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {c.byPriority.stockout_imminent > 0 && (
                  <Badge tone="red">{c.byPriority.stockout_imminent} quiebre</Badge>
                )}
                {c.byPriority.low_stock > 0 && (
                  <Badge tone="amber">{c.byPriority.low_stock} riesgo</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {c.sales30Units === null ? "venta s/d" : `${formatNumber(c.sales30Units)} unid. 30d`}{" "}
                · compra sug. {formatCurrencyCompact(c.suggestedAmountClp)}
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
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">Sin datos suficientes para este ranking.</p>
        ) : (
          <BarList items={items} />
        )}
      </CardBody>
    </Card>
  );
}
