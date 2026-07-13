import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { StatusBadge } from "../../components/business/StatusBadge";
import { supplierFulfillment } from "../../utils/supplierPerf";
import { hashString as hashN } from "../../utils/hash";
import type { Supplier } from "../../types/purchasing";
import { formatCurrency, formatDate, formatDays, formatNumber } from "../../utils/formatters";

interface EvalDim {
  label: string;
  value: number;
}

function supplierEvaluation(supplier: Supplier): { score: number; dims: EvalDim[] } {
  const h = hashN(supplier.id);
  const perf = supplierFulfillment(supplier.name);
  const fecha = Math.round(supplier.deliveryCompliance);
  const cantidad =
    perf.fillRate || Math.max(40, Math.round(supplier.deliveryCompliance - 4 + (h % 10)));
  const calidad = 70 + (h % 26); // 70–95
  const factura = 91 + (h % 9); // exactitud de facturación 91–99
  const documentos = 80 + ((h >> 3) % 18); // 80–97
  const precios = 78 + ((h >> 5) % 22); // estabilidad de precios 78–99
  const dims: EvalDim[] = [
    { label: "Cumplimiento de fecha", value: fecha },
    { label: "Cumplimiento de cantidad", value: cantidad },
    { label: "Calidad", value: calidad },
    { label: "Exactitud de factura", value: factura },
    { label: "Exactitud documental", value: documentos },
    { label: "Estabilidad de precios", value: precios },
  ];
  const weights = [0.28, 0.22, 0.18, 0.12, 0.1, 0.1];
  const score = Math.round(dims.reduce((a, d, i) => a + d.value * weights[i], 0));
  return { score, dims };
}

function scoreTone(v: number): "green" | "amber" | "red" {
  if (v >= 85) return "green";
  if (v >= 70) return "amber";
  return "red";
}

const BAR_COLOR: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

function ContactCard({
  title,
  contact,
}: {
  title: string;
  contact?: { nombre: string; email: string; telefono: string };
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {contact ? (
        <div className="mt-1">
          <p className="text-sm font-medium text-slate-800">{contact.nombre}</p>
          <p className="text-xs text-slate-500 truncate">{contact.email}</p>
          <p className="text-xs text-slate-500">{contact.telefono}</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400 mt-1">Sin contacto registrado</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Tabla de productos clave para la negociación: permite ver de un vistazo los
//  más vendidos, los que más días de inventario acumulan, los de menor margen
//  y los de mayor ganancia — la información que se pone sobre la mesa al negociar.

/** Ficha maestra del proveedor (#1) + evaluación multidimensional (#11). */
export function SupplierMaster({ supplier }: { supplier: Supplier }) {
  const { score, dims } = supplierEvaluation(supplier);
  const minimo =
    supplier.minimoCompra != null
      ? supplier.minimoCompraTipo === "unidades"
        ? `${formatNumber(supplier.minimoCompra)} u.`
        : formatCurrency(supplier.minimoCompra)
      : "—";

  return (
    <div className="space-y-4">
      {/* Datos y contactos */}
      <Card>
        <CardHeader
          title="Ficha del proveedor"
          description="Datos maestros, contactos y condiciones comerciales."
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">RUT</p>
              <p className="text-slate-800 font-medium">{supplier.rut}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Estado</p>
              <StatusBadge kind="supplier" value={supplier.status} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Condición de pago</p>
              <p className="text-slate-800">{supplier.condicionPago ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Plazo de entrega</p>
              <p className="text-slate-800">
                {supplier.plazoEntregaDias != null
                  ? formatDays(supplier.plazoEntregaDias)
                  : formatDays(supplier.averageLeadTimeDays)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Mínimo de compra</p>
              <p className="text-slate-800">{minimo}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Categorías</p>
              <p className="text-slate-800">{supplier.categories.join(", ")}</p>
            </div>
          </div>

          {supplier.marcas && supplier.marcas.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">Marcas que representa</p>
              <div className="flex flex-wrap gap-1.5">
                {supplier.marcas.map((m) => (
                  <Badge key={m} tone="neutral">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ContactCard title="Comercial" contact={supplier.contactoComercial} />
            <ContactCard title="Logística" contact={supplier.contactoLogistica} />
            <ContactCard title="Cobranza" contact={supplier.contactoCobranza} />
          </div>
        </CardBody>
      </Card>

      {/* Evaluación (#11) */}
      <Card>
        <CardHeader
          title="Evaluación del proveedor"
          description="Score ponderado. Fecha y cantidad son datos reales; el resto es simulado (demo)."
          action={<Badge tone={scoreTone(score)}>{score}/100</Badge>}
        />
        <CardBody className="space-y-2.5">
          {dims.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-44 text-sm text-slate-600 flex-shrink-0">{d.label}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${BAR_COLOR[scoreTone(d.value)]}`}
                  style={{ width: `${Math.min(100, Math.max(3, d.value))}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm font-medium text-slate-800">{d.value}</span>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Documentos tributarios y acuerdos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Documentos tributarios" />
          <CardBody className="space-y-2">
            {supplier.documentosTributarios && supplier.documentosTributarios.length > 0 ? (
              supplier.documentosTributarios.map((d) => (
                <div
                  key={`${d.tipo}-${d.numero}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="text-slate-800">{d.tipo}</span>{" "}
                    <span className="text-xs text-slate-400 font-mono">{d.numero}</span>
                    {d.vence && (
                      <span className="text-xs text-slate-400"> · vence {formatDate(d.vence)}</span>
                    )}
                  </span>
                  <Badge tone={d.vigente ? "green" : "red"}>
                    {d.vigente ? "Vigente" : "Vencido"}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Sin documentos registrados.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Acuerdos comerciales" />
          <CardBody className="space-y-2">
            {supplier.acuerdosComerciales && supplier.acuerdosComerciales.length > 0 ? (
              supplier.acuerdosComerciales.map((a) => (
                <div key={a.titulo} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{a.titulo}</p>
                  <p className="text-xs text-slate-500">{a.detalle}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Sin acuerdos registrados.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
