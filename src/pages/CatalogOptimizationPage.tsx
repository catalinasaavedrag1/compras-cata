import { useMemo } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { CatalogRedundancy } from "../components/business/CatalogRedundancy";
import { ScopeToggle, useCategoryScope } from "../components/business/ScopeToggle";
import { products } from "../data/mockProducts";
import { useUrlState } from "../utils/useUrlState";

/**
 * Catálogo optimizado: detecta productos redundantes (SKUs que se solapan
 * dentro de una subcategoría) para racionalizar el surtido y liberar capital.
 */
export function CatalogOptimizationPage() {
  const [cat, setCat] = useUrlState("cat", "");
  const { scope, setScope, inScope, myCategories } = useCategoryScope();

  // Alcance del comprador: por defecto solo sus categorías asignadas.
  const base = useMemo(() => products.filter((p) => inScope(p.category)), [inScope]);

  const categoryNames = useMemo(
    () => Array.from(new Set(base.map((p) => p.category))).sort(),
    [base]
  );

  const scopedProducts = useMemo(
    () => (cat ? base.filter((p) => p.category === cat) : base),
    [base, cat]
  );

  return (
    <div>
      <PageHeader
        title="Surtido redundante"
        description="Productos repetidos dentro de una misma subcategoría que puedes racionalizar: SKUs que se solapan con uno mejor. Libera capital inmovilizado."
        action={
          <div className="flex items-center gap-2">
            <ScopeToggle scope={scope} onChange={setScope} myCount={myCategories.length} />
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

      <CatalogRedundancy products={scopedProducts} scopeLabel={cat || undefined} />
    </div>
  );
}
