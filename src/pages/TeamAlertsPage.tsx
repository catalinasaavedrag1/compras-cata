import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { BuyerDetailDrawer } from "../components/business/BuyerDetailDrawer";
import { buyers } from "../data/mockBuyers";
import { leaderAlerts } from "../data/mockLeaderAlerts";
import type { Buyer, LeaderAlert } from "../types/team";
import { IconAlerts, IconArrowRight } from "../components/ui/icons";

const SEV: Record<string, { label: string; tone: "red" | "amber" | "slate"; accent: string }> = {
  high: { label: "Alta", tone: "red", accent: "#f43f5e" },
  medium: { label: "Media", tone: "amber", accent: "#f59e0b" },
  low: { label: "Baja", tone: "slate", accent: "#94a3b8" },
};

const TYPE_LABEL: Record<LeaderAlert["type"], string> = {
  perf_drop: "Desempeño",
  overload: "Sobrecarga",
  underload: "Baja carga",
  stockouts: "Quiebres",
  no_owner: "Sin responsable",
  goal_risk: "Meta en riesgo",
  no_supplier: "Proveedor",
};

const IMPACT: Record<LeaderAlert["type"], string> = {
  perf_drop: "Riesgo de seguir bajando si no hay apoyo a tiempo.",
  overload: "Mayor probabilidad de quiebres y errores por exceso de trabajo.",
  underload: "Capacidad desaprovechada que podría aliviar a otros.",
  stockouts: "Venta perdida activa en sus categorías.",
  no_owner: "Nadie está reponiendo ni negociando esa categoría.",
  goal_risk: "La meta no se cumpliría al cierre del período.",
  no_supplier: "No se puede generar reposición sin proveedor.",
};

export function TeamAlertsPage() {
  const navigate = useNavigate();
  const [sel, setSel] = useState<Buyer | null>(null);

  const list = [...leaderAlerts].sort(
    (x, y) => ({ high: 0, medium: 1, low: 2 }[x.severity] - { high: 0, medium: 1, low: 2 }[y.severity])
  );
  const count = (s: string) => leaderAlerts.filter((a) => a.severity === s).length;

  const handle = (a: LeaderAlert) => {
    if (a.type === "overload" || a.type === "underload" || a.type === "no_owner") {
      navigate("/equipo/carga");
    } else if (a.type === "goal_risk") {
      navigate("/equipo/metas");
    } else if (a.buyer) {
      const b = buyers.find((z) => z.name === a.buyer);
      if (b) setSel(b);
    }
  };

  return (
    <div>
      <PageHeader
        title="Alertas del equipo"
        description="Lo que necesita tu intervención como líder. Cada alerta dice qué pasa, por qué importa y qué hacer."
      />

      <div className="flex flex-wrap gap-2.5 mb-4">
        <Badge tone="red" dot>{count("high")} de alta prioridad</Badge>
        <Badge tone="amber" dot>{count("medium")} media</Badge>
        <Badge tone="slate" dot>{count("low")} baja</Badge>
      </div>

      <div className="space-y-3">
        {list.map((a) => {
          const sev = SEV[a.severity];
          return (
            <Card key={a.id} className="p-4 flex gap-4 items-start" >
              <div className="self-stretch w-1 rounded-full flex-shrink-0" style={{ background: sev.accent }} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Badge tone={sev.tone}>Severidad {sev.label}</Badge>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{TYPE_LABEL[a.type]}</span>
                  <span className="text-xs text-slate-300">·</span>
                  <span className="text-xs font-medium text-slate-500">{a.buyer ?? "Área"}</span>
                </div>
                <p className="text-[15px] font-semibold text-slate-800">{a.title}</p>
                <p className="text-sm text-slate-500 mt-1 leading-snug">{a.detail}</p>
                <div className="flex items-start gap-2 mt-2.5 bg-amber-50 rounded-lg px-3 py-2">
                  <IconAlerts className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-amber-800 leading-snug"><b className="font-semibold">Por qué importa:</b> {IMPACT[a.type]}</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Acción</span>
                <Button size="sm" onClick={() => handle(a)} icon={<IconArrowRight className="w-3.5 h-3.5" />}>{a.action}</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <BuyerDetailDrawer buyer={sel} onClose={() => setSel(null)} />
    </div>
  );
}
