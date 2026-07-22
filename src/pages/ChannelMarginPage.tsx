import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { HelpNote } from "../components/business/HelpNote";
import { IconSales } from "../components/ui/icons";

// ============================================================================
//  Margen por canal — estado informativo honesto.
//  ---------------------------------------------------------------------------
//  El precio de venta y el margen por canal (marketplace, web, tienda) NO
//  existen como fuente real en el motor de compras: no hay precio de venta ni
//  comisiones/descuentos por canal en el contrato. Antes esta pantalla se
//  alimentaba de un mock; calcular márgenes por canal sin esa fuente sería
//  inventar cifras. Se conserva la cáscara de la vista y se explica qué se
//  mostrará cuando la fuente exista.
// ============================================================================

export function ChannelMarginPage() {
  return (
    <div>
      <PageHeader
        title="Margen por canal"
        description="Compara, por producto, el precio y el margen en marketplace, web y tienda."
      />

      <HelpNote className="mb-4" title="Por qué está vacío:">
        El motor de compras entrega <b>costo</b>, <b>margen %</b> y <b>venta en unidades</b>, pero no
        el <b>precio de venta</b> ni las <b>comisiones o descuentos por canal</b>. Comparar el margen
        entre marketplace, web y tienda exige esa fuente, que hoy no existe. Para no mostrar cifras
        inventadas, esta vista queda en espera de la integración de márgenes por canal.
      </HelpNote>

      <Card>
        <CardBody>
          <EmptyState
            icon={<IconSales className="w-6 h-6" />}
            title="Sin fuente de margen por canal"
            description="Disponible cuando exista la fuente de margen por canal (precio de venta, comisiones y descuentos por marketplace, web y tienda). Mientras tanto, revisa el margen general por SKU en Productos y en Ranking & liquidación."
          />
        </CardBody>
      </Card>
    </div>
  );
}
