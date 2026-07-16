import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { InfoHint } from "../components/business/InfoHint";
import { FilterBar } from "../components/business/FilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { IconPlus, IconArrowUp, IconAlerts, IconBox, IconCheck } from "../components/ui/icons";
import { useToast } from "../context/ToastContext";
import { useLocalStorage } from "../utils/useLocalStorage";
import { uniqueValues } from "../utils/filters";
import { formatDelta } from "../utils/formatters";
import {
  PRICE_LISTS,
  SUPPLIERS_WITH_PRODUCTS,
  LOW_MARGIN_THRESHOLD,
  buildPriceListItems,
  summarizeList,
  type PriceList,
  type PriceListItem,
  type PriceListEstado,
} from "../data/mockPriceLists";
import {
  PriceListSelector,
  PriceListSummaryCard,
  PriceItemsTable,
} from "./PriceIncreasesSections";

const ALZA_OPTIONS = [
  { value: "4", label: "Alza moderada (~4%)" },
  { value: "8", label: "Alza media (~8%)" },
  { value: "12", label: "Alza fuerte (~12%)" },
  { value: "-3", label: "Baja general (~-3%)" },
];

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
        help={
          <InfoHint label="Cómo funcionan las alzas">
            <p>
              Aquí gestionas los <b>cambios de costo</b> que envían los proveedores. El margen nuevo
              asume que el precio de venta <b>no cambia</b>: por eso un alza de costo lo reduce.
            </p>
            <p>
              Aprobar actualizaría el costo en el catálogo y notificaría a precios y catálogo
              (simulado en esta demo).
            </p>
          </InfoHint>
        }
      />

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
          <PriceListSelector lists={lists} selectedId={selected?.id} onSelect={setSelId} />

          {selected && summary && (
            <>
              {/* resumen de la lista activa */}
              <PriceListSummaryCard selected={selected} summary={summary} />

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
              <PriceItemsTable items={filtered} sort={sort} onSortChange={cycleSort} />

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
