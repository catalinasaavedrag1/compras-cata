import { PageHeader } from "../components/ui/PageHeader";
import { Tabs } from "../components/ui/Tabs";
import { useUrlState } from "../utils/useUrlState";
import { PurchaseQualityPage } from "./PurchaseQualityPage";
import { DecisionsPage } from "./DecisionsPage";

/**
 * Aprendizaje de compra: fusiona "Calidad de compra" (sugerido vs comprado y su
 * resultado) con el "Historial de decisiones" (por qué se compró así y cómo
 * resultó). Una sola vista de aprendizaje, en dos sub-pestañas.
 */
export function AprendizajePage() {
  const [tab, setTab] = useUrlState("tab", "calidad");
  const view = tab === "decisiones" ? "decisiones" : "calidad";

  return (
    <div>
      <PageHeader
        title="Aprendizaje de compra"
        description="¿Se compró corto, saludable o de más? Sugerido vs comprado y su resultado — para no repetir errores."
      />

      <Tabs
        className="mb-4"
        value={view}
        onChange={setTab}
        tabs={[
          { value: "calidad", label: "Calidad de compra" },
          { value: "decisiones", label: "Historial de decisiones" },
        ]}
      />

      {view === "calidad" ? <PurchaseQualityPage embedded /> : <DecisionsPage embedded />}
    </div>
  );
}
