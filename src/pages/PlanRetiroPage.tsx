import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { HelpNote } from "../components/business/HelpNote";
import { IconTruck } from "../components/ui/icons";
import { LogisticsPlanView } from "../components/business/LogisticsPlan";
import { useOcDraft } from "../context/OcDraftContext";
import { formatCurrency } from "../utils/formatters";

// ============================================================================
//  Plan de retiro
//  Simulación logística del borrador de compra en curso. No es un módulo
//  aparte del proceso de compra: lee el mismo borrador de OC y muestra cómo se
//  retirará físicamente la mercadería antes de emitir la orden.
// ============================================================================

export function PlanRetiroPage() {
  const navigate = useNavigate();
  const { items, count, totalAmount } = useOcDraft();

  const lines = useMemo(
    () => items.map((i) => ({ sku: i.sku, productName: i.productName, quantity: i.quantity })),
    [items]
  );

  return (
    <div>
      <PageHeader
        title="Comprar · Plan de retiro"
        description="Cómo se retirará físicamente la mercadería de esta compra: camiones, capacidad, centros, fechas, costo logístico y alternativas."
        action={
          <Button
            variant="secondary"
            icon={<IconTruck className="w-4 h-4" />}
            onClick={() => navigate("/comprar/borradores")}
          >
            Volver al borrador
          </Button>
        }
      />

      {count === 0 ? (
        <Card>
          <EmptyState
            title="No hay una compra en curso"
            description="Arma un borrador de orden de compra y aquí verás su plan de retiro: cuántos camiones necesitas, qué productos van en cada uno y cuánto costará llevar la mercadería."
            action={<Button onClick={() => navigate("/comprar/borradores")}>Ir a borradores</Button>}
          />
        </Card>
      ) : (
        <>
          <HelpNote className="mb-4">
            En materiales de construcción el retiro es parte de la decisión de compra. Este plan
            estima el transporte de tu borrador actual ({count} SKU · {formatCurrency(totalAmount)})
            para que decidas por <b>costo total de abastecimiento</b>, no solo por precio de compra.
          </HelpNote>
          <LogisticsPlanView lines={lines} />
        </>
      )}
    </div>
  );
}
