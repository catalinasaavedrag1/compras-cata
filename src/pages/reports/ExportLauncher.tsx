import { ExportButton } from "../../components/business/ExportButton";
import { suppliers } from "../../data/mockSuppliers";
import type { Product } from "../../types/purchasing";
import type { BuyerBuyRow, CategoryBuyRow, CategoryMarginRow, OpenOrderRow, ProductAlertRow, ReportKey, SupplierBuyRow } from "./definitions";
import { alertCsv, buyerCsv, categoryCsv, marginCsv, openCsv, perfCsv, rotationCsv, supplierCsv } from "./csv";

export function ExportLauncher(props: {
  report: ReportKey;
  supplierRows: SupplierBuyRow[];
  categoryRows: CategoryBuyRow[];
  buyerRows: BuyerBuyRow[];
  openOrders: OpenOrderRow[];
  rotationRows: Product[];
  categoryMarginRows: CategoryMarginRow[];
  productAlertRows: ProductAlertRow[];
  supplierPerfRows: typeof suppliers;
}) {
  switch (props.report) {
    case "compras_proveedor":
      return (
        <ExportButton
          filename="compras-por-proveedor"
          rows={props.supplierRows}
          columns={supplierCsv}
          label="Exportar CSV"
        />
      );
    case "compras_categoria":
      return (
        <ExportButton
          filename="compras-por-categoria"
          rows={props.categoryRows}
          columns={categoryCsv}
          label="Exportar CSV"
        />
      );
    case "compras_comprador":
      return (
        <ExportButton
          filename="compras-por-comprador"
          rows={props.buyerRows}
          columns={buyerCsv}
          label="Exportar CSV"
        />
      );
    case "oc_abiertas":
      return (
        <ExportButton
          filename="oc-abiertas-atrasadas"
          rows={props.openOrders}
          columns={openCsv}
          label="Exportar CSV"
        />
      );
    case "rotacion":
      return (
        <ExportButton
          filename="rotacion-inventario"
          rows={props.rotationRows}
          columns={rotationCsv}
          label="Exportar CSV"
        />
      );
    case "margen_categoria":
      return (
        <ExportButton
          filename="margen-por-categoria"
          rows={props.categoryMarginRows}
          columns={marginCsv}
          label="Exportar CSV"
        />
      );
    case "alertas_producto":
      return (
        <ExportButton
          filename="productos-sin-venta-criticos"
          rows={props.productAlertRows}
          columns={alertCsv}
          label="Exportar CSV"
        />
      );
    case "peores_proveedores":
      return (
        <ExportButton
          filename="cumplimiento-proveedores"
          rows={props.supplierPerfRows}
          columns={perfCsv}
          label="Exportar CSV"
        />
      );
  }
}
