import { useMemo } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { CatalogRedundancy } from "../components/business/CatalogRedundancy";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { useProductsCatalog } from "../hooks/useProductsCatalog";
import { useUrlState } from "../utils/useUrlState";

// ============================================================================
//  Surtido redundante — sobre el catálogo real del motor (useProductsCatalog).
//  El alcance "mi cartera / todas" lo resuelve el backend (scope del hook); el
//  filtro por categoría se aplica client-side sobre la página cargada.
// ============================================================================

export function CatalogOptimizationPage() {
  const [cat, setCat] = useUrlState("cat", "");
  const { scope, setScope } = useCategoryScope();
  const { rows, meta, loading, error, configured, refetch } = useProductsCatalog();

  const categoryNames = useMemo(
    () =>
      Array.from(new Set(rows.map((p) => p.categoryName).filter((v): v is string => !!v))).sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [rows]
  );

  const scopedRows = useMemo(
    () => (cat ? rows.filter((p) => p.categoryName === cat) : rows),
    [rows, cat]
  );

  const pageTitle = "Surtido redundante";
  const pageDescription =
    "SKUs sin rotación con stock dentro de una categoría que puedes racionalizar. Libera capital inmovilizado.";

  if (!configured) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Conexión no configurada</p>
            <p className="mt-1 text-sm text-slate-500">
              Configura <code className="font-mono text-slate-700">VITE_PURCHASE_BFF_URL</code> para
              analizar el catálogo real del motor.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && meta === null && !error) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Cargando catálogo">
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

  if (error && meta === null) {
    return (
      <div>
        <PageHeader title={pageTitle} description={pageDescription} />
        <Card>
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">No se pudo cargar el catálogo</p>
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
        action={
          <div className="flex items-center gap-2">
            <ScopeToggle scope={scope} onChange={setScope} />
            <Select
              aria-label="Filtrar por categoría"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              placeholder="Todas las categorías"
              options={categoryNames.map((c) => ({ value: c, label: c }))}
              className="sm:w-56"
            />
          </div>
        }
      />

      <CatalogRedundancy rows={scopedRows} />
    </div>
  );
}
