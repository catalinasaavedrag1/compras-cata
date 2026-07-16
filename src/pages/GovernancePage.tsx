import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Tabs } from "../components/ui/Tabs";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { useTrace } from "../context/TraceContext";
import { formatDate } from "../utils/formatters";
import { IconCheck, IconClose } from "../components/ui/icons";

// ============================================================================
//  Gobierno: roles y permisos, matriz de aprobación y bitácora de cambios.
//  Cubre configuración/gobierno (área 26) y trazabilidad (área 24).
// ============================================================================

const PERMISOS = [
  { accion: "Ver su cartera y decidir compras", comprador: true, lider: true },
  { accion: "Construir propuestas y borradores de OC", comprador: true, lider: true },
  { accion: "Negociar con proveedores", comprador: true, lider: true },
  { accion: "Solicitar aprobación de compras fuera de criterio", comprador: true, lider: false },
  { accion: "Aprobar / rechazar compras", comprador: false, lider: true },
  { accion: "Ver panel del equipo y ranking de compradores", comprador: false, lider: true },
  { accion: "Editar reglas y parámetros de reposición", comprador: true, lider: true },
  { accion: "Asignar categorías y presupuesto a compradores", comprador: false, lider: true },
];

const MATRIZ = [
  {
    criterio: "Monto alto",
    umbral: "OC sobre $10M",
    aprobador: "Líder de Compras",
    tone: "amber" as const,
  },
  {
    criterio: "Desvío sobre la sugerencia",
    umbral: "Cantidad > 20% del sugerido",
    aprobador: "Líder de Compras",
    tone: "amber" as const,
  },
  {
    criterio: "Cobertura excesiva",
    umbral: "Compra deja > 90 días de cobertura",
    aprobador: "Líder de Compras",
    tone: "violet" as const,
  },
  {
    criterio: "Margen bajo",
    umbral: "Margen del SKU < mínimo de la regla",
    aprobador: "Líder de Compras",
    tone: "red" as const,
  },
  {
    criterio: "Proveedor en revisión / nuevo",
    umbral: "Proveedor con bajo cumplimiento o sin historial",
    aprobador: "Líder de Compras",
    tone: "blue" as const,
  },
  {
    criterio: "Fuera de temporada",
    umbral: "Compra estacional fuera de ventana",
    aprobador: "Líder de Compras",
    tone: "slate" as const,
  },
];

export function GovernancePage() {
  const [tab, setTab] = useState("roles");
  const { entries } = useTrace();

  return (
    <div>
      <PageHeader
        title="Gobierno y trazabilidad"
        description="Quién puede hacer qué, qué compras requieren aprobación y el registro de todos los cambios."
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "roles", label: "Roles y permisos" },
          { value: "matriz", label: "Matriz de aprobación" },
          { value: "bitacora", label: "Bitácora", count: entries.length },
        ]}
      />

      {tab === "roles" && (
        <Card>
          <CardHeader
            title="Roles y permisos"
            description="Qué puede hacer cada perfil en la plataforma"
          />
          <CardBody className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2 text-center">Comprador</th>
                  <th className="px-3 py-2 text-center">Líder de Compras</th>
                </tr>
              </thead>
              <tbody>
                {PERMISOS.map((p) => (
                  <tr key={p.accion} className="border-b border-slate-100">
                    <td className="px-3 py-2.5 text-slate-700">{p.accion}</td>
                    <td className="px-3 py-2.5 text-center">
                      <PermCell on={p.comprador} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PermCell on={p.lider} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {tab === "matriz" && (
        <Card>
          <CardHeader
            title="Matriz de aprobación"
            description="Compras que se desvían del criterio pasan por aprobación antes de emitirse"
          />
          <CardBody className="space-y-2">
            {MATRIZ.map((m) => (
              <div
                key={m.criterio}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={m.tone} dot>
                      {m.criterio}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{m.umbral}</p>
                </div>
                <span className="flex-shrink-0 text-sm font-medium text-slate-700">
                  Aprueba: {m.aprobador}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === "bitacora" && (
        <Card>
          <CardHeader
            title="Bitácora de cambios"
            description="Quién cambió qué, valor anterior → nuevo, cuándo y por qué"
          />
          <CardBody>
            {entries.length === 0 ? (
              <EmptyState
                title="Sin cambios registrados"
                description="Aquí se registran los cambios de reglas, reclamos y decisiones."
              />
            ) : (
              <ol className="space-y-2">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1 rounded-lg border border-slate-100 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {e.action} · <span className="text-slate-500">{e.entity}</span>
                      </p>
                      {(e.before !== undefined || e.after !== undefined) && (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {e.field ? `${e.field}: ` : ""}
                          <span className="text-slate-400 line-through">{e.before ?? "—"}</span>
                          {" → "}
                          <span className="font-medium text-slate-700">{e.after ?? "—"}</span>
                        </p>
                      )}
                      {e.reason && <p className="mt-0.5 text-xs text-slate-400">{e.reason}</p>}
                    </div>
                    <div className="flex-shrink-0 text-right text-xs text-slate-400">
                      <p>{formatDate(e.date)}</p>
                      <p>{e.actor}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function PermCell({ on }: { on: boolean }) {
  return on ? (
    <IconCheck className="mx-auto h-4 w-4 text-emerald-500" aria-label="Sí" />
  ) : (
    <IconClose className="mx-auto h-4 w-4 text-slate-300" aria-label="No" />
  );
}
