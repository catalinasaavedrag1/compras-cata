import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { StatusBadge } from "../../components/business/StatusBadge";
import type { SupplierFichaData } from "../../services/purchaseBff";
import { formatDate, formatPercent } from "../../utils/formatters";

// ---------------------------------------------------------------------------
//  Ficha maestra del proveedor (F11): datos de la relación comercial real
//  (RUT, código SAP, estado) y las condiciones comerciales vigentes
//  (terms[0], historia append-only). Los contactos y documentos tributarios
//  del mock no tienen fuente en el contrato: se declaran pendientes.
// ---------------------------------------------------------------------------

const fmtDate = (iso: string | null | undefined) => (iso ? formatDate(iso.slice(0, 10)) : "—");

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-slate-800 font-medium">{value}</p>
    </div>
  );
}

/** Ficha maestra + condiciones vigentes sobre la ficha real. */
export function SupplierMaster({ data }: { data: SupplierFichaData }) {
  const current = data.terms[0];

  return (
    <div className="space-y-4">
      {/* Datos maestros de la relación */}
      <Card>
        <CardHeader
          title="Ficha del proveedor"
          description="Datos maestros de la relación comercial en el servicio de compras."
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Field label="RUT" value={data.rut ?? "—"} />
            <Field label="Código SAP" value={data.sapCardCode ?? "—"} />
            <div>
              <p className="text-xs text-slate-400">Estado</p>
              <StatusBadge kind="supplier" value={data.status} />
            </div>
            <Field label="Id de relación" value={data.supplierId} />
            <Field label="Métricas al" value={fmtDate(data.metrics.asOf)} />
          </div>
          <p className="text-xs text-slate-400">
            Contactos y documentos tributarios se conectan cuando el maestro los publique.
          </p>
        </CardBody>
      </Card>

      {/* Condiciones comerciales vigentes (terms[0]) */}
      <Card>
        <CardHeader
          title="Condiciones comerciales vigentes"
          description="Última versión registrada (la historia completa está en la pestaña Negociación)."
          action={current?.validFrom ? <Badge tone="green">desde {fmtDate(current.validFrom)}</Badge> : undefined}
        />
        <CardBody>
          {!current ? (
            <p className="text-sm text-slate-400">
              Sin condiciones registradas. Regístralas desde la pestaña Negociación.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">Condición de pago</span>
                <span className="text-sm font-medium text-slate-800">
                  {current.paymentTermRef ?? "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">Descuento base</span>
                <span className="text-sm font-medium text-slate-800">
                  {current.discountPct != null ? formatPercent(current.discountPct, 1) : "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">Flete</span>
                <span className="text-sm font-medium text-slate-800">
                  {current.freightPolicy ?? "—"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-400">Moneda</span>
                <span className="text-sm font-medium text-slate-800">{current.currency ?? "CLP"}</span>
              </div>
              <div className="flex flex-col sm:col-span-2">
                <span className="text-[11px] text-slate-400">Notas</span>
                <span className="text-sm font-medium text-slate-800">{current.notes ?? "—"}</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
