import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { categoryPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { DataTable, type Column } from "../components/ui/Table";
import { FilterBar } from "../components/business/FilterBar";
import { StatusBadge } from "../components/business/StatusBadge";
import { KpiCard } from "../components/business/KpiCard";
import { MoreActions } from "../components/ui/MoreActions";
import { exportToCsv } from "../utils/exportCsv";
import { useToast } from "../context/ToastContext";
import { products as mockProducts } from "../data/mockProducts";
import { useCollection } from "../context/DataContext";
import { filterProducts, uniqueValues } from "../utils/filters";
import { useUrlState, useUrlToggle } from "../utils/useUrlState";
import { coverageDays, estimatedStockoutDate } from "../utils/calculations";
import { TODAY_ISO } from "../utils/constants";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "../utils/formatters";
import { IconProducts, IconAlerts, IconSuppliers, IconSales } from "../components/ui/icons";
import type { Product } from "../types/purchasing";

const PRODUCT_CSV_COLUMNS = [
  { label: "SKU", value: (p: Product) => p.sku },
  { label: "Nombre", value: (p: Product) => p.name },
  { label: "Categoría", value: (p: Product) => p.category },
  { label: "Marca", value: (p: Product) => p.brand },
  { label: "Proveedor", value: (p: Product) => p.supplierName },
  { label: "Costo", value: (p: Product) => p.cost },
  { label: "Precio", value: (p: Product) => p.price },
  { label: "Margen %", value: (p: Product) => p.margin },
  { label: "Stock disponible", value: (p: Product) => p.availableStock },
  { label: "Venta 30 días", value: (p: Product) => p.salesLast30Days },
  { label: "Estado compra", value: (p: Product) => p.purchaseStatus },
];

export function ProductsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const allProducts = useCollection<Product>("products", mockProducts);

  const [query, setQuery] = useUrlState("q");
  const [category, setCategory] = useUrlState("cat");
  const [subcategory, setSubcategory] = useUrlState("sub");
  const [brand, setBrand] = useUrlState("marca");
  const [supplier, setSupplier] = useUrlState("prov");
  const [productStatus, setProductStatus] = useUrlState("comercial");
  const [purchaseStatus, setPurchaseStatus] = useUrlState("compra");
  const [outOfStock, toggleOutOfStock] = useUrlToggle("stock");
  const [toggles, setToggles] = useState({
    lowMargin: false,
    noSupplier: false,
    noSales: false,
    outdatedCost: false,
  });

  const filtered = useMemo(() => {
    let result = filterProducts(allProducts, {
      query,
      category,
      subcategory,
      brand,
      supplier,
      productStatus,
      purchaseStatus,
      lowMargin: toggles.lowMargin,
      noSupplier: toggles.noSupplier,
      noSales: toggles.noSales,
    });
    if (toggles.outdatedCost) {
      result = result.filter((p) => p.costUpdatedAt < "2026-04-01");
    }
    if (outOfStock) {
      result = result.filter((p) => p.availableStock <= 0);
    }
    return result;
  }, [allProducts, query, category, subcategory, brand, supplier, productStatus, purchaseStatus, toggles, outOfStock]);

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setSubcategory("");
    setBrand("");
    setSupplier("");
    setProductStatus("");
    setPurchaseStatus("");
    setToggles({ lowMargin: false, noSupplier: false, noSales: false, outdatedCost: false });
    if (outOfStock) toggleOutOfStock();
  };

  // KPIs según el resultado filtrado (se actualizan con los filtros)
  const lowMarginCount = filtered.filter((p) => p.margin < 25).length;
  const noSupplierCount = filtered.filter((p) => !p.supplierName).length;
  const noSalesCount = filtered.filter((p) => p.salesLast30Days === 0).length;

  const columns: Column<Product>[] = [
    {
      key: "product",
      header: "Producto",
      render: (p) => (
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">{p.sku}</span>
            <span className="text-xs text-slate-400">{p.brand}</span>
          </div>
          <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
          <p className="text-xs text-slate-500"><Link to={categoryPath(p.category)} className="hover:text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>{p.category}</Link> · {p.subcategory}</p>
        </div>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      hideOnMobile: true,
      render: (p) =>
        p.supplierName ? (
          <span className="text-sm text-slate-700">{p.supplierName}</span>
        ) : (
          <span className="text-xs text-rose-500 font-medium">Sin proveedor</span>
        ),
    },
    {
      key: "cost",
      header: "Costo / Precio",
      align: "right",
      hideOnMobile: true,
      render: (p) => (
        <div className="text-sm">
          <p className="text-slate-700">{formatCurrency(p.price)}</p>
          <p className="text-xs text-slate-400">{formatCurrency(p.cost)} costo</p>
        </div>
      ),
    },
    {
      key: "margin",
      header: "Margen",
      align: "right",
      render: (p) => (
        <span className={p.margin < 25 ? "text-amber-600 font-medium" : "text-slate-700"}>
          {formatPercent(p.margin)}
        </span>
      ),
    },
    {
      key: "stock",
      header: "Stock disp. / total",
      align: "right",
      render: (p) => (
        <div className="text-sm">
          <p className={p.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>
            {formatNumber(p.availableStock)}
          </p>
          <p className="text-xs text-slate-400">{formatNumber(p.totalStock)} total</p>
        </div>
      ),
    },
    {
      key: "sales",
      header: "Venta mes",
      align: "right",
      hideOnMobile: true,
      render: (p) => <span className="text-slate-700">{formatNumber(p.salesLast30Days)}</span>,
    },
    {
      key: "stockout",
      header: "Quiebre estimado",
      align: "right",
      hideOnMobile: true,
      render: (p) => {
        if (p.availableStock <= 0 && p.salesLast30Days > 0)
          return <span className="text-rose-600 font-semibold">En quiebre</span>;
        const date = estimatedStockoutDate(p.availableStock, p.salesLast30Days, TODAY_ISO);
        if (!date) return <span className="text-slate-300">—</span>;
        const cover = coverageDays(p.availableStock, p.salesLast30Days);
        return (
          <span className={cover <= p.supplierLeadTimeDays ? "text-rose-600 font-medium" : cover <= p.supplierLeadTimeDays * 2 ? "text-amber-600" : "text-slate-600"}>
            {formatDate(date)}
          </span>
        );
      },
    },
    {
      key: "rotation",
      header: "Rotación",
      align: "right",
      hideOnMobile: true,
      render: (p) => <span className="text-slate-700">{p.rotation.toLocaleString("es-CL")}x</span>,
    },
    {
      key: "productStatus",
      header: "Estado comercial",
      render: (p) => <StatusBadge kind="product" value={p.productStatus} />,
    },
    {
      key: "purchaseStatus",
      header: "Estado compra",
      render: (p) => <StatusBadge kind="purchase" value={p.purchaseStatus} dot={false} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Productos / SKUs"
        description="Revisa stock, margen, rotación y estado del surtido."
        action={
          <MoreActions
            actions={[
              {
                label: "Exportar a CSV",
                onClick: () => {
                  exportToCsv("productos", filtered, PRODUCT_CSV_COLUMNS);
                  toast.success(`Se exportaron ${filtered.length} productos a productos.csv`);
                },
              },
            ]}
          />
        }
      />

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar SKU, producto o marca"
          resultCount={filtered.length}
          summary={`${filtered.length} productos · ${filtered.filter((p) => p.availableStock <= 0).length} sin stock · ${lowMarginCount} margen bajo · ${noSupplierCount} sin proveedor`}
          onClear={clearFilters}
          selects={[
            { key: "cat", placeholder: "Categoría", value: category, onChange: setCategory, options: uniqueValues(allProducts, (p) => p.category).map((c) => ({ value: c, label: c })) },
            { key: "sub", placeholder: "Subcategoría", value: subcategory, onChange: setSubcategory, options: uniqueValues(allProducts, (p) => p.subcategory).map((c) => ({ value: c, label: c })) },
            { key: "brand", placeholder: "Marca", value: brand, onChange: setBrand, options: uniqueValues(allProducts, (p) => p.brand).map((c) => ({ value: c, label: c })) },
            { key: "sup", placeholder: "Proveedor", value: supplier, onChange: setSupplier, options: uniqueValues(allProducts.filter((p) => p.supplierName), (p) => p.supplierName).map((c) => ({ value: c, label: c })) },
            {
              key: "pstatus",
              placeholder: "Estado comercial",
              value: productStatus,
              onChange: setProductStatus,
              options: [
                { value: "active", label: "Activo" },
                { value: "new", label: "Nuevo" },
                { value: "discontinued", label: "Descontinuado" },
                { value: "no_sales", label: "Sin venta" },
                { value: "seasonal", label: "Temporada" },
                { value: "blocked", label: "Bloqueado" },
              ],
            },
            {
              key: "buystatus",
              placeholder: "Estado compra",
              value: purchaseStatus,
              onChange: setPurchaseStatus,
              options: [
                { value: "buy", label: "Comprar" },
                { value: "do_not_buy", label: "No comprar" },
                { value: "review", label: "Revisar" },
                { value: "on_demand", label: "Bajo pedido" },
                { value: "overstock", label: "Sobrestock" },
              ],
            },
          ]}
          toggles={[
            { key: "outOfStock", label: "Sin stock", active: outOfStock, onToggle: toggleOutOfStock },
            { key: "lowMargin", label: "Margen bajo", active: toggles.lowMargin, onToggle: () => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin })) },
            { key: "noSupplier", label: "Sin proveedor", active: toggles.noSupplier, onToggle: () => setToggles((t) => ({ ...t, noSupplier: !t.noSupplier })) },
            { key: "noSales", label: "Sin venta", active: toggles.noSales, onToggle: () => setToggles((t) => ({ ...t, noSales: !t.noSales })) },
            { key: "outdated", label: "Sin costo actualizado", active: toggles.outdatedCost, onToggle: () => setToggles((t) => ({ ...t, outdatedCost: !t.outdatedCost })) },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard title="SKUs en vista" value={formatNumber(filtered.length)} tone="info" icon={<IconProducts className="w-4 h-4" />} description="Según filtros" />
        <KpiCard title="Margen bajo (<25%)" value={formatNumber(lowMarginCount)} tone="warn" icon={<IconSales className="w-4 h-4" />} description="Filtrar" active={toggles.lowMargin} onClick={() => setToggles((t) => ({ ...t, lowMargin: !t.lowMargin }))} />
        <KpiCard title="Sin proveedor" value={formatNumber(noSupplierCount)} tone={noSupplierCount ? "bad" : "good"} icon={<IconSuppliers className="w-4 h-4" />} description="Filtrar" active={toggles.noSupplier} onClick={() => setToggles((t) => ({ ...t, noSupplier: !t.noSupplier }))} />
        <KpiCard title="Sin venta (30d)" value={formatNumber(noSalesCount)} tone="warn" icon={<IconAlerts className="w-4 h-4" />} description="Filtrar" active={toggles.noSales} onClick={() => setToggles((t) => ({ ...t, noSales: !t.noSales }))} />
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(p) => p.sku}
          onRowClick={(p) => navigate(`/productos/${p.sku}`)}
          mobileCard={(p) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-mono text-slate-400">{p.sku}</span>
                  <p className="font-medium text-slate-800 leading-snug">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.category} · {p.brand}</p>
                </div>
                <StatusBadge kind="purchase" value={p.purchaseStatus} dot={false} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Stock disp.</p>
                  <p className={p.availableStock <= 0 ? "text-rose-600 font-semibold" : "text-slate-700"}>{formatNumber(p.availableStock)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Venta mes</p>
                  <p className="text-slate-700">{formatNumber(p.salesLast30Days)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Margen</p>
                  <p className={p.margin < 25 ? "text-amber-600 font-medium" : "text-slate-700"}>{formatPercent(p.margin)}</p>
                </div>
              </div>
            </div>
          )}
        />
      </Card>
    </div>
  );
}
