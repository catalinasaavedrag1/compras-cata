import { useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { BUYER_TONE_AV } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";
import type { Buyer } from "../types/team";
import { WORKLOAD_CFG, workloadBarColor, byWorkloadDesc } from "../utils/teamScore";
import { useToast } from "../context/ToastContext";
import { formatNumber } from "../utils/formatters";

const LEVELS = [
  { label: "Baja", color: "#3366f2" },
  { label: "Normal", color: "#10b981" },
  { label: "Alta", color: "#f59e0b" },
  { label: "Crítica", color: "#f43f5e" },
];

interface ReassignState { category: string; from: Buyer; }
interface OffboardState { buyer: Buyer; mode: string; }

export function WorkloadPage() {
  const toast = useToast();
  const [reassign, setReassign] = useState<ReassignState | null>(null);
  const [offboard, setOffboard] = useState<OffboardState | null>(null);

  const board = [...buyers].sort(byWorkloadDesc);

  return (
    <div>
      <PageHeader
        title="Carga & reasignación"
        description="La carga (0–100%) pondera categorías, proveedores, SKUs, OC abiertas, compras pendientes y quiebres. Equilibra moviendo categorías o redistribuyendo al dar de baja a alguien."
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-4 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Niveles</span>
          {LEVELS.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
        {board.map((b) => {
          const wl = WORKLOAD_CFG[b.workload];
          const factors = [
            { label: "Categorías", value: String(b.categories.length) },
            { label: "Proveedores", value: String(b.suppliers) },
            { label: "SKUs", value: formatNumber(b.products) },
            { label: "OC abiertas", value: String(b.openPO) },
            { label: "Compras pend.", value: String(b.pending) },
            { label: "Quiebres", value: String(b.stockouts) },
          ];
          return (
            <Card key={b.id}>
              <CardBody>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${BUYER_TONE_AV[b.tone]}`}>{b.initials}</span>
                  <p className="flex-1 text-sm font-semibold text-slate-800">{b.name}</p>
                  <Badge tone={wl.tone}>Carga {wl.label} · {b.workloadPct}%</Badge>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-3.5">
                  <div className="h-full rounded-full" style={{ width: `${b.workloadPct}%`, background: workloadBarColor(b.workloadPct) }} />
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3.5">
                  {factors.map((f) => (
                    <div key={f.label} className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-[15px] font-semibold text-slate-700">{f.value}</p>
                      <p className="text-[10.5px] text-slate-400">{f.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Mover una categoría a otro comprador</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {b.categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setReassign({ category: c, from: b })}
                      className="inline-flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50/40"
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" size="sm" onClick={() => setOffboard({ buyer: b, mode: "carga" })}>
                  Dar de baja y redistribuir
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Modal reasignar categoría */}
      <Modal
        open={!!reassign}
        onClose={() => setReassign(null)}
        title="Reasignar categoría"
        description={reassign ? `Mover ${reassign.category} desde ${reassign.from.name}. Elige el destino y revisa el impacto en la carga.` : ""}
      >
        {reassign && (
          <div className="space-y-3">
            {buyers.filter((t) => t.id !== reassign.from.id).map((t) => {
              const share = Math.round(reassign.from.workloadPct / Math.max(1, reassign.from.categories.length));
              const newPct = Math.min(100, t.workloadPct + Math.round(share * 0.9));
              return (
                <div key={t.id} className="border border-slate-200 rounded-xl p-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[t.tone]}`}>{t.initials}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                      <p className="text-xs text-slate-400">Carga actual {WORKLOAD_CFG[t.workload].label} · {t.workloadPct}% → <b className="text-slate-600">{newPct}%</b> (+{Math.round(share * 0.9)} pts)</p>
                    </div>
                    <Button size="sm" onClick={() => { toast.success(`${reassign.category} reasignada de ${reassign.from.name} a ${t.name}`); setReassign(null); }}>
                      Asignar aquí
                    </Button>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2.5">
                    <div className="h-full rounded-full" style={{ width: `${newPct}%`, background: workloadBarColor(newPct) }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Modal dar de baja y redistribuir */}
      <Modal
        open={!!offboard}
        onClose={() => setOffboard(null)}
        title="Dar de baja y redistribuir"
        description={offboard ? `${offboard.buyer.name} dejará el equipo. Redistribuye su trabajo: ${offboard.buyer.categories.length} categorías · ${offboard.buyer.suppliers} proveedores · ${formatNumber(offboard.buyer.products)} productos · ${offboard.buyer.pending} compras pendientes.` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOffboard(null)}>Cancelar</Button>
            <Button onClick={() => { if (offboard) toast.success(`Trabajo de ${offboard.buyer.name} redistribuido entre el equipo`); setOffboard(null); }}>Confirmar redistribución</Button>
          </>
        }
      >
        {offboard && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Criterio de redistribución</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "equitativa", label: "Distribución equitativa", desc: "Reparte por igual entre los demás compradores." },
                  { id: "carga", label: "Por carga laboral", desc: "Asigna primero a quienes tienen menos carga." },
                  { id: "especialidad", label: "Por especialidad", desc: "Asigna según categorías afines a cada comprador." },
                  { id: "manual", label: "Manual", desc: "Tú decides el destino de cada categoría." },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setOffboard({ ...offboard, mode: m.id })}
                    className={`text-left border rounded-xl px-3 py-2.5 ${offboard.mode === m.id ? "border-brand-400 bg-brand-50/40" : "border-slate-200 hover:border-slate-300"}`}
                  >
                    <span className="block text-sm font-semibold text-slate-800">{m.label}</span>
                    <span className="block text-[11px] text-slate-400 leading-tight mt-0.5">{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Impacto en la carga del equipo</p>
              <div className="space-y-2.5">
                {buyers.filter((x) => x.id !== offboard.buyer.id).sort((x, y) => (offboard.mode === "carga" ? x.workloadPct - y.workloadPct : 0)).map((t, i, arr) => {
                  const add = offboard.mode === "carga"
                    ? (i === 0 ? Math.round(offboard.buyer.workloadPct * 0.5) : Math.round((offboard.buyer.workloadPct * 0.5) / (arr.length - 1)))
                    : Math.round(offboard.buyer.workloadPct / arr.length);
                  const newPct = Math.min(100, t.workloadPct + add);
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${BUYER_TONE_AV[t.tone]}`}>{t.initials}</span>
                      <span className="w-28 flex-shrink-0 text-xs text-slate-600 truncate">{t.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${newPct}%`, background: workloadBarColor(newPct) }} />
                      </div>
                      <span className="w-24 flex-shrink-0 text-right text-xs font-semibold text-emerald-600">+{add} pts → {newPct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
