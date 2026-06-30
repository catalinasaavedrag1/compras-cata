import { useMemo } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { CatalogRedundancy } from "../components/business/CatalogRedundancy";
import { products } from "../data/mockProducts";
import { useUrlState } from "../utils/useUrlState";

/**
 * Catálogo optimizado: detecta productos redundantes (SKUs que se solapan
 * dentro de una subcategoría) para racionalizar el surtido y liberar capital.
 */
export function CatalogOptimizationPage() {
  const [cat, setCat] = useUrlState("cat", "");

  const categoryNames = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    []
  );

  const scoped = useMemo(
    () => (cat ? products.filter((p) => p.category === cat) : products),
    [cat]
  );

  return (
    <div>
      <PageHeader
        title="Surtido redundante"
        description="Productos repetidos dentro de una misma subcategoría que puedes racionalizar: SKUs que se solapan con uno mejor. Libera capital inmovilizado."
        action={
          <Select
            aria-label="Filtrar por categoría"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            placeholder="Todas las categorías"
            options={categoryNames.map((c) => ({ value: c, label: c }))}
            className="sm:w-60"
          />
        }
      />

      <CatalogRedundancy products={scoped} scopeLabel={cat || undefined} />
    </div>
  );
}
