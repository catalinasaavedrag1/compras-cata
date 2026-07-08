import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { productPath, categoryPath, supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { FilterBar } from "../components/business/FilterBar";
import { DataTable, type Column } from "../components/ui/Table";
import { EmptyState } from "../components/ui/EmptyState";
import {
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconAlerts,
  IconBox,
  IconCheck,
} from "../components/ui/icons";
import { useToast } from "../context/ToastContext";
import { useLocalStorage } from "../utils/useLocalStorage";
import { uniqueValues } from "../utils/filters";
import { formatCurrency, formatPercent, formatDelta, formatDate } from "../utils/formatters";
import {
  PRICE_LISTS,
  SUPPLIERS_WITH_PRODUCTS,
  TARGET_MARGIN_BY_CATEGORY,
  LOW_MARGIN_THRESHOLD,
  buildPriceListItems,
  summarizeList,
  type PriceList,
  type PriceListItem,
  type PriceListEstado,
} from "../data/mockPriceLists";

const ESTADO_CFG: Record<PriceListEstado, { label: string; tone: "amber" | "green" | "red" }> = {
  pendiente: { label: "Pendiente", tone: "amber" },
  aprobada: { label: "Aprobada", tone: "green" },
  rechazada: { label: "Rechazada", tone: "red" },
};

const ALZA_OPTIONS = [
  { value: "4", label: "Alza moderada (~4%)" },
  { value: "8", label: "Alza media (~8%)" },
  { value: "12", label: "Alza fuerte (~12%)" },
  { value: "-3", label: "Baja general (~-3%)" },
];

function targetFor(category: string): number {
  return TARGET_MARGIN_BY_CATEGORY[category] ?? 25;
}

export function PriceIncreasesPage() {
  const toast = useToast();
  const [lists, setLists] = useLocalStorage<PriceList[]>("compras:price-lists", PRICE_LISTS);

  const [selId, setSelId] = useState(lists[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tipo, setTipo] = useState(""); // "alza" | "baja" | "margen-bajo"
  const [sort, setSort] = useState<{ key: string | null; dir: "asc" | "desc" }>({
    key: "alzaPct",
    dir: "desc",
  });

  // Carga simulada de lista
  const [uploadOpen, setUploadOpen] = useState(false);
  const [upProveedor, setUpProveedor] = useState(SUPPLIERS_WITH_PRODUCTS[0] ?? "");
  const [upAlza, setUpAlza] = useState("8");

  const selected = lists.find((l) => l.id === selId) ?? lists[0];

  // ---- KPIs globales (sobre listas pendientes) ----
  const pendientes = lists.filter((l) => l.estado === "pendiente");
  const productosAfectados = pendientes.reduce((a, l) => a + l.items.length, 0);
  const alzaPromedioGlobal = useMemo(() => {
    const all = pendientes.flatMap((l) => l.items);
    if (all.length === 0) return 0;
    return Math.round((all.reduce((a, it) => a + it.alzaPct, 0) / all.length) * 10) / 10;
  }, [pendientes]);
  const conMargenBajoGlobal = pendientes.reduce(
    (a, l) => a + l.items.filter((it) => it.margenNuevoPct < LOW_MARGIN_THRESHOLD).length,
    0
  );

  // ---- ítems filtrados de la lista activa ----
  const filtered = useMemo<PriceListItem[]>(() => {
    if (!selected) return [];
    return selected.items.filter((it) => {
      if (
        query.trim() &&
        !`${it.sku} ${it.productName}`.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      if (category && it.category !== category) return false;
      if (tipo === "alza" && it.alzaPct <= 0) return false;
      if (tipo === "baja" && it.alzaPct >= 0) return false;
      if (tipo === "margen-bajo" && it.margenNuevoPct >= LOW_MARGIN_THRESHOLD) return false;
      return true;
    });
  }, [selected, query, category, tipo]);

  const summary = selected ? summarizeList(selected) : null;
  const categoryOptions = selected
    ? uniqueValues(selected.items, (it) => it.category).map((c) => ({ value: c, label: c }))
    : [];

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setTipo("");
  };

  const cycleSort = (key: string) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  // ---- acciones ----
  const setEstado = (estado: PriceListEstado) => {
    if (!selected) return;
    setLists((prev) => prev.map((l) => (l.id === selected.id ? { ...l, estado } : l)));
    if (estado === "aprobada") {
      toast.success(
        `Alza de "${selected.proveedor}" aprobada. Se actualizaría el costo y se notificaría a precios (simulado).`
      );
    } else if (estado === "rechazada") {
      toast.info(`Lista de "${selected.proveedor}" rechazada. Se mantiene el costo vigente.`);
    } else {
      toast.info(`Lista de "${selected.proveedor}" marcada como pendiente.`);
    }
  };

  const handleUpload = () => {
    const base = parseFloat(upAlza) || 0;
    const items = buildPriceListItems(upProveedor, base);
    if (items.length === 0) {
      toast.warning(`No hay productos del proveedor "${upProveedor}" en el catálogo.`);
      return;
    }
    const id = `PL-DEMO-${lists.length + 1}`;
    const nueva: PriceList = {
      id,
      proveedor: upProveedor,
      vigenteDesde: "2026-07-15",
      estado: "pendiente",
      items,
    };
    setLists((prev) => [nueva, ...prev]);
    setSelId(id);
    setUploadOpen(false);
    toast.success(`Lista de "${upProveedor}" cargada con ${items.length} productos (demo).`);
  };

  const previewItems = useMemo(
    () => buildPriceListItems(upProveedor, parseFloat(upAlza) || 0),
    [upProveedor, upAlza]
  );
  const previewSummary = useMemo(
    () =>
      summarizeList({
        id: "preview",
        proveedor: upProveedor,
        vigenteDesde: "",
        estado: "pendiente",
        items: previewItems,
      }),
    [upProveedor, previewItems]
  );

  // ---- columnas tabla ----
  const columns: Column<PriceListItem>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (it) => (
        <div className="min-w-0">
          <Link
            to={productPath(it.sku)}
            className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline"
          >
            {it.productName}
          </Link>
          <p className="text-[11px] text-slate-400">
            {it.sku} ·{" "}
            <Link to={categoryPath(it.category)} className="hover:text-brand-700 hover:underline">
              {it.category}
            </Link>
          </p>
        </div>
      ),
    },
    {
      key: "costo",
      header: "Costo actual → nuevo",
      align: "right",
      sortable: true,
      sortValue: (it) => it.alzaPct,
      render: (it) => {
        const isAlza = it.alzaPct > 0;
        const isBaja = it.alzaPct < 0;
        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[11px] text-slate-400 line-through">
                {formatCurrency(it.costoActual)}
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {formatCurrency(it.costoNuevo)}
              </span>
            </div>
            <Badge tone={isAlza ? "red" : isBaja ? "green" : "neutral"} className="mt-0.5">
              {isAlza ? (
                <IconArrowUp className="w-3 h-3" />
              ) : isBaja ? (
                <IconArrowDown className="w-3 h-3" />
              ) : null}
              {it.alzaPct === 0 ? "Sin cambio" : formatDelta(it.alzaPct)}
            </Badge>
          </div>
        );
      },
    },
    {
      key: "margen",
      header: "Margen actual → nuevo",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (it) => it.margenNuevoPct,
      render: (it) => {
        const cae = it.margenNuevoPct < it.margenActualPct;
        const bajo = it.margenNuevoPct < LOW_MARGIN_THRESHOLD;
        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[11px] text-slate-400">
                {formatPercent(it.margenActualPct)}
              </span>
              <span className="text-slate-300">→</span>
              <span
                className={`text-sm font-semibold ${bajo ? "text-rose-600" : cae ? "text-amber-600" : "text-emerald-600"}`}
              >
                {formatPercent(it.margenNuevoPct)}
              </span>
            </div>
            {bajo && (
              <p className="text-[11px] text-rose-500">Quedaría bajo {LOW_MARGIN_THRESHOLD}%</p>
            )}
          </div>
        );
      },
    },
    {
      key: "sugerido",
      header: "Precio venta sugerido",
      align: "right",
      hideOnMobile: true,
      sortable: true,
      sortValue: (it) => it.precioVentaSugerido,
      render: (it) => (
        <div className="whitespace-nowrap">
          <span className="text-sm font-semibold text-brand-700">
            {formatCurrency(it.precioVentaSugerido)}
          </span>
          <p className="text-[11px] text-slate-400">
            objetivo {formatPercent(targetFor(it.category), 0)}
          </p>
        </div>
      ),
    },
  ];

  const mobileCard = (it: PriceListItem) => {
    const isAlza = it.alzaPct > 0;
    const isBaja = it.alzaPct < 0;
    const bajo = it.margenNuevoPct < LOW_MARGIN_THRESHOLD;
    return (
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={productPath(it.sku)}
              className="text-sm font-medium text-slate-800 hover:text-brand-700 hover:underline block truncate"
            >
              {it.productName}
            </Link>
            <p className="text-[11px] text-slate-400">
              {it.sku} · {it.category}
            </p>
          </div>
          <Badge tone={isAlza ? "red" : isBaja ? "green" : "neutral"}>
            {it.alzaPct === 0 ? "Sin cambio" : formatDelta(it.alzaPct)}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Costo</span>
          <span>
            <span className="text-slate-400 line-through">{formatCurrency(it.costoActual)}</span>{" "}
            <b className="text-slate-800">{formatCurrency(it.costoNuevo)}</b>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Margen</span>
          <span>
            <span className="text-slate-400">{formatPercent(it.margenActualPct)}</span> →{" "}
            <b className={bajo ? "text-rose-600" : "text-slate-800"}>
              {formatPercent(it.margenNuevoPct)}
            </b>
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Precio sugerido</span>
          <b className="text-brand-700">{formatCurrency(it.precioVentaSugerido)}</b>
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Alzas de precio"
        description="Recibe la nueva lista de precios de un proveedor, compara el costo nuevo contra el actual, detecta alzas y bajas, mide el impacto en el margen y aprueba o rechaza el cambio."
        action={
          <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => setUploadOpen(true)}>
            Cargar lista de precios
          </Button>
        }
      />

      <HelpNote className="mb-4">
        Aquí gestionas los <b>cambios de costo</b> que envían los proveedores. El margen nuevo asume
        que el precio de venta <b>no cambia</b>: por eso un alza de costo lo reduce. Aprobar
        actualizaría el costo en el catálogo y notificaría a precios y catálogo (simulado en esta
        demo).
      </HelpNote>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Listas pendientes"
          value={String(pendientes.length)}
          tone="info"
          icon={<IconBox className="w-4 h-4" />}
          description="Por revisar"
        />
        <KpiCard
          title="Productos afectados"
          value={String(productosAfectados)}
          tone="neutral"
          icon={<IconBox className="w-4 h-4" />}
          description="En listas pendientes"
        />
        <KpiCard
          title="Alza promedio"
          value={formatDelta(alzaPromedioGlobal)}
          tone={alzaPromedioGlobal > 0 ? "warn" : "good"}
          icon={<IconArrowUp className="w-4 h-4" />}
          description="Costo, listas pendientes"
        />
        <KpiCard
          title={`Margen bajo (<${LOW_MARGIN_THRESHOLD}%)`}
          value={String(conMargenBajoGlobal)}
          tone={conMargenBajoGlobal > 0 ? "bad" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Si no se ajusta el precio"
        />
      </div>

      {lists.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No hay listas de precios"
              description="Carga una lista de un proveedor para empezar a revisar las alzas."
              action={
                <Button icon={<IconPlus className="w-4 h-4" />} onClick={() => setUploadOpen(true)}>
                  Cargar lista de precios
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* selector de lista (estilo CampaignsPage) */}
          <div className="flex flex-wrap gap-2.5 mb-4">
            {lists.map((l) => {
              const active = l.id === selected?.id;
              const cfg = ESTADO_CFG[l.estado];
              return (
                <button
                  key={l.id}
                  onClick={() => setSelId(l.id)}
                  className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-2.5 min-w-[170px] text-left ${active ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <span
                    className={`text-sm font-semibold ${active ? "text-brand-700" : "text-slate-700"}`}
                  >
                    {l.proveedor}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Badge tone={cfg.tone}>{cfg.label}</Badge>
                    <span className={`text-xs ${active ? "text-brand-500" : "text-slate-400"}`}>
                      {l.items.length} prod.
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selected && summary && (
            <>
              {/* resumen de la lista activa */}
              <Card className="mb-4">
                <CardBody className="flex flex-wrap items-center gap-7">
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Link
                        to={supplierPath(selected.proveedor)}
                        className="text-lg font-bold text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {selected.proveedor}
                      </Link>
                      <Badge tone={ESTADO_CFG[selected.estado].tone} dot>
                        {ESTADO_CFG[selected.estado].label}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selected.id} · vigente desde {formatDate(selected.vigenteDesde)}
                    </p>
                  </div>
                  <div className="flex gap-6 flex-wrap">
                    <div>
                      <p className="text-xs text-slate-400">Productos</p>
                      <p className="text-lg font-semibold text-slate-800">{summary.productos}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Alza prom.</p>
                      <p
                        className={`text-lg font-semibold ${summary.alzaPromedioPct > 0 ? "text-rose-600" : summary.alzaPromedioPct < 0 ? "text-emerald-600" : "text-slate-700"}`}
                      >
                        {formatDelta(summary.alzaPromedioPct)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Alzas / bajas</p>
                      <p className="text-lg font-semibold text-slate-800">
                        {summary.enAlza} / {summary.enBaja}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Impacto margen</p>
                      <p
                        className={`text-lg font-semibold ${summary.impactoMargenPts < 0 ? "text-rose-600" : "text-emerald-600"}`}
                      >
                        {summary.impactoMargenPts.toLocaleString("es-CL", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}{" "}
                        pts
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Margen bajo</p>
                      <p
                        className={`text-lg font-semibold ${summary.conMargenBajo > 0 ? "text-rose-600" : "text-emerald-600"}`}
                      >
                        {summary.conMargenBajo}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* filtros */}
              <div className="mb-4">
                <FilterBar
                  searchValue={query}
                  onSearchChange={setQuery}
                  searchPlaceholder="Buscar SKU o producto"
                  resultCount={filtered.length}
                  summary={`${filtered.length} de ${summary.productos} productos · ${summary.enAlza} en alza · ${summary.conMargenBajo} con margen bajo`}
                  onClear={clearFilters}
                  selects={[
                    {
                      key: "cat",
                      placeholder: "Categoría",
                      value: category,
                      onChange: setCategory,
                      options: categoryOptions,
                    },
                    {
                      key: "tipo",
                      placeholder: "Tipo de cambio",
                      value: tipo,
                      onChange: setTipo,
                      options: [
                        { value: "alza", label: "Solo alzas" },
                        { value: "baja", label: "Solo bajas" },
                        {
                          value: "margen-bajo",
                          label: `Quedan con margen bajo (<${LOW_MARGIN_THRESHOLD}%)`,
                        },
                      ],
                    },
                  ]}
                />
              </div>

              {/* tabla de ítems */}
              <Card className="overflow-hidden">
                <DataTable
                  columns={columns}
                  data={filtered}
                  rowKey={(it) => it.sku}
                  sort={sort}
                  onSortChange={cycleSort}
                  rowClassName={(it) =>
                    it.margenNuevoPct < LOW_MARGIN_THRESHOLD ? "bg-rose-50/40" : undefined
                  }
                  emptyMessage="No hay productos con estos filtros en esta lista."
                  mobileCard={mobileCard}
                />
              </Card>

              {/* acciones de la lista */}
              <Card className="mt-4">
                <CardBody className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm text-slate-600">
                    {selected.estado === "pendiente" ? (
                      <>
                        Revisa el impacto y decide. Aprobar <b>actualizaría el costo</b> y
                        notificaría a precios/catálogo (simulado).
                      </>
                    ) : selected.estado === "aprobada" ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-700">
                        <IconCheck className="w-4 h-4" /> Alza aprobada. El costo se actualizaría y
                        se notificaría a precios (simulado).
                      </span>
                    ) : (
                      <span className="text-rose-700">
                        Lista rechazada. Se mantiene el costo vigente.
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {selected.estado === "pendiente" ? (
                      <>
                        <Button variant="secondary" onClick={() => setEstado("rechazada")}>
                          Rechazar
                        </Button>
                        <Button
                          icon={<IconCheck className="w-4 h-4" />}
                          onClick={() => setEstado("aprobada")}
                        >
                          Aprobar alza
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={() => setEstado("pendiente")}>
                        Volver a pendiente
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </>
          )}
        </>
      )}

      {/* Modal: cargar lista de precios (demo) */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Cargar lista de precios"
        description="Simula la recepción de una nueva lista de un proveedor."
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancelar
            </Button>
            <Button
              icon={<IconPlus className="w-4 h-4" />}
              onClick={handleUpload}
              disabled={previewItems.length === 0}
            >
              Cargar lista
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <HelpNote variant="tip">
            Demo: en producción se subiría un archivo (Excel/CSV) o se recibiría por integración.
            Aquí elegimos un proveedor y un alza base para <b>generar una vista previa</b> a partir
            del catálogo.
          </HelpNote>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Proveedor</label>
              <Select
                value={upProveedor}
                onChange={(e) => setUpProveedor(e.target.value)}
                options={SUPPLIERS_WITH_PRODUCTS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Alza base de la lista
              </label>
              <Select
                value={upAlza}
                onChange={(e) => setUpAlza(e.target.value)}
                options={ALZA_OPTIONS}
              />
            </div>
          </div>

          {previewItems.length === 0 ? (
            <EmptyState
              title="Sin productos"
              description={`El proveedor "${upProveedor}" no tiene productos en el catálogo.`}
            />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Vista previa</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[11px] text-slate-400">Productos</p>
                  <p className="text-base font-semibold text-slate-800">
                    {previewSummary.productos}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Alza prom.</p>
                  <p
                    className={`text-base font-semibold ${previewSummary.alzaPromedioPct > 0 ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {formatDelta(previewSummary.alzaPromedioPct)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">En alza</p>
                  <p className="text-base font-semibold text-slate-800">{previewSummary.enAlza}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Margen bajo</p>
                  <p
                    className={`text-base font-semibold ${previewSummary.conMargenBajo > 0 ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {previewSummary.conMargenBajo}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
