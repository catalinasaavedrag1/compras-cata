import { useState } from "react";
import { Link } from "react-router-dom";
import { supplierPath } from "../utils/entityLinks";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/business/KpiCard";
import { HelpNote } from "../components/business/HelpNote";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../context/ToastContext";
import { usePurchaseFlow, type ApprovalState } from "../context/PurchaseFlowContext";
import { useBuyer } from "../context/BuyerContext";
import { useRole } from "../context/RoleContext";
import { CRITERION_LABEL } from "../data/mockApprovals";
import { IconCheck, IconAlerts, IconOrders } from "../components/ui/icons";
import { formatCurrency, formatCurrencyCompact, formatNumber } from "../utils/formatters";

type Decision = ApprovalState;

export function ApprovalsPage() {
  const toast = useToast();
  const { approvals, approvalState, setApprovalState } = usePurchaseFlow();
  const { buyer } = useBuyer();
  const { role } = useRole();
  const [filter, setFilter] = useState<Decision | "todas">("pendiente");

  // Un comprador solo ve y gestiona SUS aprobaciones; el líder, las de todo el equipo.
  const approvalRequests = role === "lider" ? approvals : approvals.filter((r) => r.buyerName === buyer);

  const stateOf = (id: string): Decision => approvalState[id] ?? "pendiente";
  const decide = (id: string, d: Decision, name: string) => {
    setApprovalState(id, d);
    toast[d === "aprobada" ? "success" : "warning"](`${name}: ${d === "aprobada" ? "aprobada" : "rechazada"}`);
  };

  const pendientes = approvalRequests.filter((r) => stateOf(r.id) === "pendiente");
  const montoPendiente = pendientes.reduce((a, r) => a + r.amount, 0);
  const aprobadas = approvalRequests.filter((r) => stateOf(r.id) === "aprobada").length;

  const filtered = approvalRequests.filter((r) => (filter === "todas" ? true : stateOf(r.id) === filter));
  const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

  return (
    <div>
      <PageHeader
        title="Aprobaciones de compra"
        description="Compras que se salen de criterio (monto, cobertura, margen, proveedor o muy distintas al sugerido). El comprador justifica el desvío; aquí se aprueba o rechaza, dejando todo trazado."
      />

      <HelpNote className="mb-4">
        No todo lo que se sale del rango es malo: un descuento por volumen o una compra de temporada pueden justificarlo.
        Pero <b>debe quedar trazado</b> el <b>sugerido vs lo solicitado</b> y el <b>motivo</b>. Eso alimenta el historial de decisiones.
      </HelpNote>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard title="Pendientes" value={formatNumber(pendientes.length)} tone={pendientes.length > 0 ? "warn" : "good"} icon={<IconAlerts className="w-4 h-4" />} />
        <KpiCard title="Monto en aprobación" value={formatCurrencyCompact(montoPendiente)} tone="info" icon={<IconOrders className="w-4 h-4" />} />
        <KpiCard title="Aprobadas" value={formatNumber(aprobadas)} tone="good" icon={<IconCheck className="w-4 h-4" />} />
        <KpiCard title="Total solicitudes" value={formatNumber(approvalRequests.length)} tone="neutral" icon={<IconOrders className="w-4 h-4" />} />
      </div>

      <div className="flex gap-2 mb-4">
        {(["pendiente", "aprobada", "rechazada", "todas"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-full ring-1 ring-inset capitalize ${filter === f ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
          >
            {f === "todas" ? "Todas" : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody><EmptyState title="Sin solicitudes" description="No hay solicitudes en este estado." /></CardBody></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const state = stateOf(r.id);
            const diff = r.requestedQty - r.suggestedQty;
            const diffPct = r.suggestedQty > 0 ? Math.round((diff / r.suggestedQty) * 100) : 100;
            return (
              <Card key={r.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <Link to={`/productos/${r.sku}`} className="text-sm font-semibold text-slate-900 hover:text-brand-700 truncate">{r.productName}</Link>
                        {state !== "pendiente" && <Badge tone={state === "aprobada" ? "green" : "red"}>{state === "aprobada" ? "Aprobada" : "Rechazada"}</Badge>}
                      </div>
                      <p className="text-xs text-slate-400">{fmtDate(r.date)} · {r.buyerName} · <Link to={supplierPath(r.supplierName)} className="hover:text-brand-600 hover:underline">{r.supplierName}</Link></p>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 flex-shrink-0">{formatCurrency(r.amount)}</p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {r.criteria.map((c) => <Badge key={c} tone="amber">{CRITERION_LABEL[c]}</Badge>)}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Sugerido → Solicitado</p>
                      <p className="text-sm font-semibold text-slate-800">{formatNumber(r.suggestedQty)} → {formatNumber(r.requestedQty)} u. <span className={`text-xs font-normal ${diff > 0 ? "text-violet-600" : "text-rose-600"}`}>({diff > 0 ? "+" : ""}{diffPct}%)</span></p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Cobertura resultante</p>
                      <p className={`text-sm font-semibold ${r.coberturaResultante > r.coberturaObjetivo * 1.3 ? "text-violet-600" : "text-slate-800"}`}>{formatNumber(r.coberturaResultante)} d <span className="text-xs font-normal text-slate-400">obj. {r.coberturaObjetivo}</span></p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Margen</p>
                      <p className={`text-sm font-semibold ${r.margin < r.minMargin ? "text-rose-600" : "text-emerald-700"}`}>{formatNumber(r.margin)}% <span className="text-xs font-normal text-slate-400">mín. {r.minMargin}%</span></p>
                    </div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Costo unitario</p>
                      <p className="text-sm font-semibold text-slate-800">{formatCurrency(r.unitCost)}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 mb-3"><span className="text-slate-400">Justificación del comprador:</span> {r.justification}</p>

                  {state === "pendiente" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(r.id, "aprobada", r.productName)} icon={<IconCheck className="w-4 h-4" />}>Aprobar</Button>
                      <Button size="sm" variant="secondary" onClick={() => decide(r.id, "rechazada", r.productName)}>Rechazar</Button>
                    </div>
                  ) : (
                    <button onClick={() => decide(r.id, "pendiente", r.productName)} className="text-xs font-medium text-slate-400 hover:text-slate-600">Revertir a pendiente</button>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
