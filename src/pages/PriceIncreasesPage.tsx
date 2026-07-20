import { useMemo, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { KpiCard } from "../components/business/KpiCard";
import { InfoHint } from "../components/business/InfoHint";
import { FilterBar } from "../components/business/FilterBar";
import { Skeleton } from "../components/ui/Skeleton";
import { IconArrowUp, IconArrowDown, IconAlerts, IconBox } from "../components/ui/icons";
import { usePriceWatch } from "../hooks/usePriceWatch";
import { formatDelta } from "../utils/formatters";
import { PriceChangesTable, type PriceSortState } from "./PriceIncreasesSections";

// ============================================================================
//  Alzas de precio de compra (F26) conectado al price-watch del BFF. Las "alzas"
//  reales son los cambios de COSTO de compra detectados desde las OC emitidas
//  (GET /price-watch/changes), no listas de precios de venta. Solo lectura
//  (permiso purchase:cost:read, de toda la mesa): se retiran la carga de listas,
//  la edición local (localStorage) y los márgenes de venta del mock, que no
//  tienen fuente en el contrato de vigilancia de costos.
//  Filtros reales: ventana (windowDays) y umbral de variación (minPct).
// ============================================================================

const WINDOW_OPTIONS = [
  { value: "30", label: "Últimos 30 días" },
  { value: "60", label: "Últimos 60 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "180", label: "Últimos 180 días" },
];

const MINPCT_OPTIONS = [
  { value: "0", label: "Cualquier variación" },
  { value: "2", label: "Variación ≥ 2%" },
  { value: "5", label: "Variación ≥ 5%" },
  { value: "10", label: "Variación ≥ 10%" },
];

export function PriceIncreasesPage() {
  const [windowDays, setWindowDays] = useState("90");
  const [minPct, setMinPct] = useState("0");

  const { items, windowDays: effectiveWindow, total, loading, error, configured, refetch } =
    usePriceWatch({ windowDays: Number(windowDays), minPct: Number(minPct) });

  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState(""); // "alza" | "baja"
  const [sort, setSort] = useState<PriceSortState>({ key: "costo", dir: "desc" });

  const cycleSort = (key: string) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (
        query.trim() &&
        !`${it.sku} ${it.skuName} ${it.supplierRef}`.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      if (tipo === "alza" && it.deltaPct <= 0) return false;
      if (tipo === "baja" && it.deltaPct >= 0) return false;
      return true;
    });
  }, [items, query, tipo]);

  const kpis = useMemo(() => {
    const alzas = items.filter((it) => it.deltaPct > 0).length;
    const bajas = items.filter((it) => it.deltaPct < 0).length;
    const avg =
      items.length > 0
        ? Math.round((items.reduce((a, it) => a + it.deltaPct, 0) / items.length) * 10) / 10
        : 0;
    return { alzas, bajas, avg };
  }, [items]);

  const pageTitle = "Alzas de precio de compra";
  const pageDescription =
    "Cambios de costo de compra detectados desde las órdenes emitidas: qué SKU subió (o bajó), en qué OC y cómo contrasta con el costo acordado.";

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
              ver los cambios de costo reales detectados desde las órdenes de compra.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && items.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando cambios de costo">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-28" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">
              No se pudieron cargar los cambios de costo
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

  return (
    <div>
      <PageHeader
        title={pageTitle}
        description={pageDescription}
        help={
          <InfoHint label="Qué muestra esta pantalla">
            <p>
              Esta es la <b>vigilancia del costo de compra</b>: compara el último costo real de cada
              SKU (el de la OC más reciente) contra el costo anterior y contra el costo{" "}
              <b>acordado</b> con el proveedor. No es el precio de venta ni el margen.
            </p>
            <p>
              Un <b>alza</b> (variación positiva) se marca en rojo; una <b>baja</b>, en verde. El
              costo acordado sirve de contraste: si el costo actual quedó por sobre lo acordado, es
              una señal para revisar con el proveedor.
            </p>
          </InfoHint>
        }
      />

      {/* KPIs derivados de los cambios reales en la ventana. */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title="Cambios detectados"
          value={String(total)}
          tone="info"
          icon={<IconBox className="w-4 h-4" />}
          description={effectiveWindow ? `Ventana de ${effectiveWindow} días` : undefined}
        />
        <KpiCard
          title="Alzas"
          value={String(kpis.alzas)}
          tone={kpis.alzas > 0 ? "bad" : "good"}
          icon={<IconArrowUp className="w-4 h-4" />}
          description="Costo al alza"
        />
        <KpiCard
          title="Bajas"
          value={String(kpis.bajas)}
          tone="good"
          icon={<IconArrowDown className="w-4 h-4" />}
          description="Costo a la baja"
        />
        <KpiCard
          title="Variación promedio"
          value={formatDelta(kpis.avg)}
          tone={kpis.avg > 0 ? "warn" : "good"}
          icon={<IconAlerts className="w-4 h-4" />}
          description="Del costo en la ventana"
        />
      </div>

      <div className="mb-4">
        <FilterBar
          searchValue={query}
          onSearchChange={setQuery}
          searchPlaceholder="Buscar SKU, producto o proveedor"
          resultCount={filtered.length}
          summary={`${filtered.length} de ${items.length} cambios · ${kpis.alzas} alzas · ${kpis.bajas} bajas`}
          onClear={() => {
            setQuery("");
            setTipo("");
          }}
          selects={[
            {
              key: "ventana",
              placeholder: "Ventana",
              value: windowDays,
              onChange: setWindowDays,
              options: WINDOW_OPTIONS,
            },
            {
              key: "umbral",
              placeholder: "Umbral",
              value: minPct,
              onChange: setMinPct,
              options: MINPCT_OPTIONS,
            },
            {
              key: "tipo",
              placeholder: "Tipo de cambio",
              value: tipo,
              onChange: setTipo,
              options: [
                { value: "alza", label: "Solo alzas" },
                { value: "baja", label: "Solo bajas" },
              ],
            },
          ]}
        />
      </div>

      {items.length === 0 ? (
        <Card>
          <div className="p-6 text-center text-sm text-slate-500">
            Sin cambios de costo en esta ventana. Ajusta la ventana o el umbral de variación.
          </div>
        </Card>
      ) : (
        <PriceChangesTable items={filtered} sort={sort} onSortChange={cycleSort} />
      )}
    </div>
  );
}
